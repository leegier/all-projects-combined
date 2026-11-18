// scraper.js — Job listing scraper for Upwork and Fiverr
// Uses Playwright. Loads saved sessions to avoid repeated login.

import { chromium } from 'playwright';
import { CONFIG, sleep, randomDelay } from './config.js';
import { readSubmitted } from './tracker.js';
import fs from 'fs-extra';
import path from 'path';

async function loadSession(browser, sessionFile) {
  if (await fs.pathExists(sessionFile)) {
    const context = await browser.newContext({
      storageState: sessionFile,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    return context;
  }
  return await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
}

// ─── UPWORK ──────────────────────────────────────────────────────────────────

export async function scrapeUpwork(keyword) {
  const browser = await chromium.launch({ headless: true });
  const context = await loadSession(browser, CONFIG.profile.upwork.sessionFile);
  const page = await context.newPage();
  const jobs = [];

  try {
    const encoded = encodeURIComponent(keyword);
    await page.goto(`https://www.upwork.com/nx/search/jobs/?q=${encoded}&sort=recency&per_page=20`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await sleep(randomDelay(CONFIG.delays.betweenActions));

    // Check if logged out
    const loginBtn = page.locator('a[href*="/login"]').first();
    const isLoggedOut = await loginBtn.isVisible().catch(() => false);
    if (isLoggedOut) {
      console.warn(`[Upwork] Not logged in — session needed. Run login first.`);
      await browser.close();
      return [];
    }

    // Wait for job tiles
    await page.waitForSelector('[data-test="job-tile"]', { timeout: 15000 }).catch(() => null);

    const tiles = await page.locator('[data-test="job-tile"]').all();
    const submitted = await readSubmitted();

    for (const tile of tiles.slice(0, CONFIG.search.upwork.maxResults)) {
      try {
        const title = await tile.locator('[data-test="job-title"]').textContent().catch(() => '');
        const desc = await tile.locator('[data-test="job-description-text"]').textContent().catch(() => '');
        const budget = await tile.locator('[data-test="budget"]').textContent().catch(() => '');
        const href = await tile.locator('[data-test="job-title"] a').getAttribute('href').catch(() => '');
        const jobId = href?.match(/\d{10,}/)?.[0] || '';
        const skills = await tile.locator('.air3-token').allTextContents().catch(() => []);

        if (!jobId || submitted.has(`upwork:${jobId}`)) continue;
        if (!title.trim()) continue;

        jobs.push({
          platform: 'upwork',
          id: jobId,
          title: title.trim(),
          description: desc.trim(),
          budget: budget.trim(),
          skills,
          url: `https://www.upwork.com${href}`,
          scrapedAt: new Date().toISOString(),
        });

        await sleep(randomDelay(CONFIG.delays.betweenActions));
      } catch (e) {
        // skip malformed tile
      }
    }

  } catch (e) {
    console.error(`[Upwork] scrape error: ${e.message}`);
  }

  await browser.close();
  return jobs;
}

// Scrape full description from individual job page
export async function scrapeUpworkJobDetail(jobUrl) {
  const browser = await chromium.launch({ headless: true });
  const context = await loadSession(browser, CONFIG.profile.upwork.sessionFile);
  const page = await context.newPage();

  try {
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(randomDelay(CONFIG.delays.betweenActions));

    const description = await page.locator('[data-test="description"]').textContent().catch(() => '');
    const clientLocation = await page.locator('[data-qa="client-location"]').textContent().catch(() => '');
    const jobType = await page.locator('[data-test="engagement-type"]').textContent().catch(() => '');
    const hourlyRange = await page.locator('[data-test="hourly-rate"]').textContent().catch(() => '');

    await browser.close();
    return { description: description.trim(), clientLocation: clientLocation.trim(), jobType: jobType.trim(), hourlyRange: hourlyRange.trim() };
  } catch (e) {
    await browser.close();
    return {};
  }
}

// ─── FIVERR BUYER REQUESTS ────────────────────────────────────────────────────

export async function scrapeFiverrRequests(category) {
  const browser = await chromium.launch({ headless: true });
  const context = await loadSession(browser, CONFIG.profile.fiverr.sessionFile);
  const page = await context.newPage();
  const requests = [];

  try {
    await page.goto('https://www.fiverr.com/buyers_requests', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await sleep(randomDelay(CONFIG.delays.betweenActions));

    const loginBtn = page.locator('a[href*="/login"]').first();
    const isLoggedOut = await loginBtn.isVisible().catch(() => false);
    if (isLoggedOut) {
      console.warn(`[Fiverr] Not logged in — session needed.`);
      await browser.close();
      return [];
    }

    await page.waitForSelector('.request-row', { timeout: 10000 }).catch(() => null);
    const rows = await page.locator('.request-row').all();
    const submitted = await readSubmitted();

    for (const row of rows.slice(0, 15)) {
      try {
        const title = await row.locator('.request-title').textContent().catch(() => '');
        const desc = await row.locator('.request-description').textContent().catch(() => '');
        const budget = await row.locator('.request-budget').textContent().catch(() => '');
        const reqId = await row.getAttribute('data-request-id').catch(() => '');

        if (!reqId || submitted.has(`fiverr:${reqId}`)) continue;

        requests.push({
          platform: 'fiverr',
          id: reqId,
          title: title.trim(),
          description: desc.trim(),
          budget: budget.trim(),
          url: 'https://www.fiverr.com/buyers_requests',
          scrapedAt: new Date().toISOString(),
        });
      } catch (e) {
        // skip
      }
    }
  } catch (e) {
    console.error(`[Fiverr] scrape error: ${e.message}`);
  }

  await browser.close();
  return requests;
}

// ─── SAVE SESSION AFTER MANUAL LOGIN ─────────────────────────────────────────

export async function saveUpworkSession() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.upwork.com/login');
  console.log('[Upwork] Log in manually. Session will be saved when you press Enter here...');

  await new Promise(resolve => process.stdin.once('data', resolve));
  await fs.ensureDir(path.dirname(CONFIG.profile.upwork.sessionFile));
  await context.storageState({ path: CONFIG.profile.upwork.sessionFile });
  console.log(`[Upwork] Session saved to ${CONFIG.profile.upwork.sessionFile}`);
  await browser.close();
}

export async function saveFiverrSession() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.fiverr.com/login');
  console.log('[Fiverr] Log in manually. Session will be saved when you press Enter here...');

  await new Promise(resolve => process.stdin.once('data', resolve));
  await fs.ensureDir(path.dirname(CONFIG.profile.fiverr.sessionFile));
  await context.storageState({ path: CONFIG.profile.fiverr.sessionFile });
  console.log(`[Fiverr] Session saved to ${CONFIG.profile.fiverr.sessionFile}`);
  await browser.close();
}
