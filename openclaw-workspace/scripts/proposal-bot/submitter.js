// submitter.js — Playwright-based proposal submission
// Handles Upwork proposal form + Fiverr buyer request response

import { chromium } from 'playwright';
import { CONFIG, sleep, randomDelay } from './config.js';
import fs from 'fs-extra';

async function loadSession(browser, sessionFile) {
  if (await fs.pathExists(sessionFile)) {
    return await browser.newContext({
      storageState: sessionFile,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
  }
  throw new Error(`No session file found at ${sessionFile}. Run login-save first.`);
}

// Simulates human typing
async function typeHuman(page, selector, text) {
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char);
    await sleep(randomDelay([30, 120]));
  }
}

// ─── UPWORK PROPOSAL SUBMISSION ───────────────────────────────────────────────

export async function submitUpworkProposal(job, proposalText, bidRate = null) {
  const browser = await chromium.launch({ headless: true });
  let context;

  try {
    context = await loadSession(browser, CONFIG.profile.upwork.sessionFile);
  } catch (e) {
    await browser.close();
    return { success: false, error: e.message };
  }

  const page = await context.newPage();

  try {
    // Navigate to the job and click Apply
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(randomDelay(CONFIG.delays.betweenActions));

    // Click apply button
    const applyBtn = page.locator('button:has-text("Apply Now"), button:has-text("Submit a Proposal")').first();
    await applyBtn.click({ timeout: 10000 });
    await sleep(randomDelay(CONFIG.delays.betweenActions));

    // Set hourly rate if applicable
    const rateInput = page.locator('input[name="rate"], input[placeholder*="rate"]').first();
    const hasRate = await rateInput.isVisible().catch(() => false);
    if (hasRate) {
      await rateInput.fill('');
      await typeHuman(page, 'input[name="rate"], input[placeholder*="rate"]', String(bidRate || CONFIG.profile.rate));
      await sleep(randomDelay(CONFIG.delays.betweenActions));
    }

    // Cover letter
    const coverLetterField = page.locator('textarea[name="cover_letter"], textarea[placeholder*="cover"], [data-test="cover-letter-input"] textarea').first();
    await coverLetterField.waitFor({ timeout: 10000 });
    await coverLetterField.click();
    await sleep(500);

    // Type the proposal with human speed
    for (const char of proposalText) {
      await page.keyboard.type(char);
      await sleep(randomDelay([25, 90]));
    }

    await sleep(randomDelay(CONFIG.delays.betweenActions));

    // Submit
    const submitBtn = page.locator('button[type="submit"]:has-text("Submit"), button:has-text("Send Proposal")').first();
    await submitBtn.click({ timeout: 10000 });

    // Confirm success
    await page.waitForURL(/jobs|proposals|my-jobs/, { timeout: 15000 }).catch(() => null);
    const successMsg = await page.locator('[data-test="success"], .up-toast-success, h1:has-text("Proposal Submitted")').isVisible().catch(() => false);

    await context.storageState({ path: CONFIG.profile.upwork.sessionFile }); // refresh session
    await browser.close();

    return { success: true, url: page.url() };
  } catch (e) {
    await browser.close();
    return { success: false, error: e.message };
  }
}

// ─── FIVERR BUYER REQUEST RESPONSE ────────────────────────────────────────────

export async function submitFiverrResponse(job, proposalText) {
  const browser = await chromium.launch({ headless: true });
  let context;

  try {
    context = await loadSession(browser, CONFIG.profile.fiverr.sessionFile);
  } catch (e) {
    await browser.close();
    return { success: false, error: e.message };
  }

  const page = await context.newPage();

  try {
    await page.goto('https://www.fiverr.com/buyers_requests', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await sleep(randomDelay(CONFIG.delays.betweenActions));

    // Find the specific request by ID
    const requestRow = page.locator(`[data-request-id="${job.id}"]`);
    await requestRow.waitFor({ timeout: 10000 });

    // Click "Send Offer" button
    const sendBtn = requestRow.locator('button:has-text("Send Offer"), button:has-text("Offer")').first();
    await sendBtn.click();
    await sleep(randomDelay(CONFIG.delays.betweenActions));

    // Select gig if prompted
    const gigSelect = page.locator('.gig-selector, [class*="gig-select"]').first();
    const hasGigSelect = await gigSelect.isVisible().catch(() => false);
    if (hasGigSelect) {
      await gigSelect.click();
      await sleep(500);
    }

    // Type proposal
    const responseField = page.locator('textarea[name="offer"], textarea[placeholder*="offer"], .offer-textarea').first();
    await responseField.waitFor({ timeout: 10000 });
    await responseField.click();

    for (const char of proposalText) {
      await page.keyboard.type(char);
      await sleep(randomDelay([25, 90]));
    }

    await sleep(randomDelay(CONFIG.delays.betweenActions));

    // Submit
    const submitBtn = page.locator('button[type="submit"]:has-text("Send"), button:has-text("Send Offer")').first();
    await submitBtn.click({ timeout: 10000 });

    await sleep(randomDelay([2000, 4000]));
    await context.storageState({ path: CONFIG.profile.fiverr.sessionFile });
    await browser.close();

    return { success: true };
  } catch (e) {
    await browser.close();
    return { success: false, error: e.message };
  }
}
