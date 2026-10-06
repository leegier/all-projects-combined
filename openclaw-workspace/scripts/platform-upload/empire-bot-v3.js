/**
 * empire-bot-v3.js — Check if EMPIRE-BOT was created, then get token + invite URL
 */
import { chromium } from 'playwright';
import fs from 'fs';

const REAL_PROFILE = 'C:\\Users\\Gierl\\AppData\\Local\\Microsoft\\Edge\\User Data';

async function run() {
  console.log('Launching Edge...');
  const browser = await chromium.launchPersistentContext(REAL_PROFILE, {
    headless: false,
    channel: 'msedge',
    slowMo: 400,
    viewport: { width: 1280, height: 900 },
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  console.log('Loading dev portal...');
  await page.goto('https://discord.com/developers/applications', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/v3-1-apps.png' });
  console.log('URL:', page.url());

  // Find EMPIRE-BOT
  let appId = null;
  const empireApp = page.locator('text=EMPIRE-BOT').first();
  if (await empireApp.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('EMPIRE-BOT already exists! Clicking it...');
    await empireApp.click();
    await page.waitForTimeout(2000);
    appId = page.url().match(/applications\/(\d+)/)?.[1];
    console.log('App ID:', appId);
  } else {
    console.log('EMPIRE-BOT not found, creating...');
    
    // Click New Application
    await page.locator('button:has-text("New Application")').first().click();
    await page.waitForTimeout(2000);

    // Fill name
    const nameInput = page.locator('input[maxlength]').first();
    await nameInput.waitFor({ timeout: 5000 });
    await nameInput.click();
    await nameInput.fill('EMPIRE-BOT');
    await page.waitForTimeout(300);

    // Tab to checkbox, Space to check
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'Z:/openclaw/workspace/v3-2-modal.png' });

    // After filling name + checking TOS, click Create — this opens a "what type of app" screen
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === 'Create' && !btn.disabled) { btn.click(); return; }
      }
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'Z:/openclaw/workspace/v3-3-typepicker.png' });
    console.log('After first Create, URL:', page.url());

    // Dump all visible buttons and text to understand modal state
    const allBtns = await page.locator('button').allTextContents();
    console.log('Visible buttons:', JSON.stringify(allBtns));
    const allText = await page.evaluate(() => {
      return [...document.querySelectorAll('h1,h2,h3,p,[class*="title"],[class*="header"]')]
        .map(el => el.textContent?.trim()).filter(Boolean).slice(0, 20);
    });
    console.log('Page text:', JSON.stringify(allText));

    // Check if template picker appeared - click "Create blank app" or "Build a bot"
    const blankApp = page.locator('button:has-text("Create blank app"), a:has-text("Create blank app")').first();
    const buildBot = page.locator('[class*="card"]:has-text("bot"), div:has-text("Build a bot"):not(:has(div:has-text("Build a bot")))').first();
    
    // Click "Create blank app" in top-right — simplest path, skips template selection
    if (await blankApp.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Clicking Create blank app...');
      await blankApp.click({ force: true });
      // Wait for navigation - poll URL every 500ms for up to 15 seconds
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(500);
        const url = page.url();
        appId = url.match(/applications\/(\d+)/)?.[1];
        console.log(`[${i}] URL: ${url}`);
        if (appId) { console.log('Got app ID!', appId); break; }
      }
      await page.screenshot({ path: 'Z:/openclaw/workspace/v3-3b-blankapp.png' });
    }

    if (!appId) {
      // Fallback: select Build a bot then Create
      if (await buildBot.isVisible({ timeout: 2000 }).catch(() => false)) {
        await buildBot.click({ force: true });
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: 'Z:/openclaw/workspace/v3-3b-beforefinalcreate.png' });
      // Use keyboard Enter on the Create button
      await page.locator('button:has-text("Create")').last().focus().catch(() => {});
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      // Or click via JS with dispatchEvent
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const createBtn = btns.find(b => b.textContent?.trim() === 'Create');
        if (createBtn) {
          createBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          createBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      });
    }
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'Z:/openclaw/workspace/v3-3-aftercreate.png' });
    appId = page.url().match(/applications\/(\d+)/)?.[1];
    console.log('After create URL:', page.url(), '| App ID:', appId);

    // If still on /applications, look for EMPIRE-BOT
    if (!appId) {
      const newApp = page.locator('text=EMPIRE-BOT').first();
      if (await newApp.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newApp.click();
        await page.waitForTimeout(2000);
        appId = page.url().match(/applications\/(\d+)/)?.[1];
        console.log('Found after create, App ID:', appId);
      }
    }
  }

  if (!appId) {
    console.log('ERROR: Could not find or create EMPIRE-BOT');
    await page.screenshot({ path: 'Z:/openclaw/workspace/v3-error.png' });
    await browser.close();
    process.exit(1);
  }

  // Navigate to Bot page
  console.log('Going to Bot page...');
  await page.goto(`https://discord.com/developers/applications/${appId}/bot`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/v3-4-bot.png' });
  console.log('Bot page URL:', page.url());

  // Reset token
  let botToken = '';
  const resetBtn = page.locator('button:has-text("Reset Token")').first();
  if (await resetBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Resetting token...');
    await resetBtn.click();
    await page.waitForTimeout(1000);
    // Confirm
    for (const sel of ['button:has-text("Yes, do it!")', 'button:has-text("Confirm")', 'button:has-text("Yes")']) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(2000);
        break;
      }
    }
  }
  await page.screenshot({ path: 'Z:/openclaw/workspace/v3-5-token.png' });

  // Try to read token via copy button
  const copyBtn = page.locator('button:has-text("Copy")').first();
  if (await copyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await copyBtn.click();
    await page.waitForTimeout(500);
    botToken = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    console.log('Token from clipboard (first 40):', botToken.substring(0, 40));
  }

  // Also try reading token from any visible text
  if (!botToken) {
    const tokenText = await page.evaluate(() => {
      const els = document.querySelectorAll('[class*="token"], code, [class*="Token"]');
      for (const el of els) {
        const text = el.textContent?.trim();
        if (text && text.length > 40 && text.includes('.')) return text;
      }
      return '';
    });
    if (tokenText) { botToken = tokenText; console.log('Token from DOM:', botToken.substring(0, 40)); }
  }

  // Enable server members + presence intents
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/v3-6-intents.png' });

  // Save changes
  const saveBtn = page.locator('button:has-text("Save Changes")').first();
  if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1000);
  }

  // OAuth2 URL Generator
  console.log('Building invite URL...');
  await page.goto(`https://discord.com/developers/applications/${appId}/oauth2/url-generator`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/v3-7-oauth.png' });

  // Check 'bot' scope checkbox
  const scopes = await page.locator('[class*="scope"], [class*="Scope"]').all();
  console.log('Scopes found:', scopes.length);
  
  // Find and click 'bot' scope
  const botScopeLabel = page.locator('label:has-text("bot"), div:has-text("bot"):not(:has(div))').first();
  await botScopeLabel.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/v3-8-botscope.png' });

  // Select Administrator permission
  const adminLabel = page.locator('label:has-text("Administrator")').first();
  await adminLabel.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/v3-9-admin.png' });

  // Get invite URL
  let inviteUrl = '';
  const urlInputs = page.locator('input[readonly]');
  const count = await urlInputs.count();
  for (let i = 0; i < count; i++) {
    const val = await urlInputs.nth(i).inputValue();
    if (val.includes('discord.com/api/oauth2') || val.includes('discord.com/oauth2')) {
      inviteUrl = val;
      break;
    }
  }
  console.log('Invite URL:', inviteUrl.substring(0, 100));

  // Visit invite URL and authorize
  if (inviteUrl) {
    console.log('Authorizing...');
    await page.goto(inviteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'Z:/openclaw/workspace/v3-10-invite.png' });

    // Select THE NYGHTSHADE HOLLOW server
    const selectors = [
      'select[name="guild_id"]',
      '[data-guild-id]',
      '[class*="guild"]'
    ];
    for (const sel of selectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await el.selectOption({ label: 'THE NYGHTSHADE HOLLOW' }).catch(async () => {
          await el.click({ force: true });
        });
        break;
      }
    }
    await page.waitForTimeout(1000);

    // Click Authorize
    const authBtn = page.locator('button:has-text("Authorize"), button[type="submit"]').first();
    if (await authBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await authBtn.click();
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: 'Z:/openclaw/workspace/v3-11-authorized.png' });
    console.log('Authorized. URL:', page.url());
  }

  // Save results
  const result = { appId, botToken, inviteUrl, createdAt: new Date().toISOString() };
  fs.writeFileSync('Z:/openclaw/workspace/empire-bot-creds.json', JSON.stringify(result, null, 2));
  
  console.log('\n=== EMPIRE-BOT RESULTS ===');
  console.log('App ID:', appId);
  console.log('Token (first 50):', botToken.substring(0, 50) || 'NOT CAPTURED - check v3-5-token.png');
  console.log('Invite URL:', inviteUrl.substring(0, 100) || 'NOT CAPTURED');

  await page.waitForTimeout(8000);
  await browser.close();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
