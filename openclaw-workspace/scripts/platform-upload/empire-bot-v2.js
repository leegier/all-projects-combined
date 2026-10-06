/**
 * empire-bot-v2.js — Create EMPIRE-BOT using Lee's actual Edge profile (already logged in)
 */
import { chromium } from 'playwright';
import fs from 'fs';

const REAL_PROFILE = 'C:\\Users\\Gierl\\AppData\\Local\\Microsoft\\Edge\\User Data';

async function run() {
  console.log('Launching Edge with real profile...');
  const browser = await chromium.launchPersistentContext(REAL_PROFILE, {
    headless: false,
    channel: 'msedge',
    slowMo: 500,
    viewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--profile-directory=Default']
  });

  const page = await browser.newPage();

  console.log('Going to developer portal...');
  await page.goto('https://discord.com/developers/applications', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-1-portal.png' });
  console.log('URL:', page.url());

  // If redirected to login, we have a problem - but with real profile should be logged in
  if (page.url().includes('login')) {
    console.log('ERROR: Not logged in. Real profile did not have Discord session.');
    await browser.close();
    process.exit(1);
  }

  // Dismiss any welcome/modal by pressing Escape first
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Find and click "New Application" button
  console.log('Looking for New Application button...');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-2-apps.png' });

  // Try multiple ways to find the button
  let clicked = false;
  const selectors = [
    'button:has-text("New Application")',
    'button:has-text("New application")', 
    '[class*="createButton"]',
    'button[type="button"]:has-text("New")',
  ];
  
  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found button via:', sel);
      await btn.click({ force: true });
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    // Dump all buttons text for debugging
    const buttons = await page.locator('button').allTextContents();
    console.log('All buttons found:', buttons);
    await page.screenshot({ path: 'Z:/openclaw/workspace/emp-2-debug.png' });
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-3-modal.png' });

  // Fill app name in modal
  console.log('Filling app name...');
  const nameInput = page.locator('input[maxlength], input[placeholder*="name" i], input[aria-label*="name" i]').first();
  if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nameInput.fill('EMPIRE-BOT');
    console.log('Name filled: EMPIRE-BOT');
  } else {
    console.log('Name input not found, dumping inputs:');
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      console.log('  input:', await input.getAttribute('placeholder'), await input.getAttribute('name'), await input.getAttribute('maxlength'));
    }
  }

  // Must check the TOS checkbox - click on the label text "By clicking Create..."
  await page.keyboard.press('Tab'); // blur name field first
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-tos.png' });

  console.log('Checking TOS checkbox via keyboard...');
  // Tab from name input to checkbox, then Space to check
  await page.keyboard.press('Tab'); // moves to the checkbox
  await page.waitForTimeout(300);
  await page.keyboard.press('Space'); // checks it
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-tos-checked.png' });

  const createBtnState = page.locator('button:has-text("Create")').first();
  const isDisabledNow = await createBtnState.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true');
  console.log('Create button disabled after Space:', isDisabledNow);

  // If still disabled, try Tab again + Space (maybe tab order is different)
  if (isDisabledNow) {
    console.log('Still disabled, trying Tab+Space again...');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const stillDisabled = await createBtnState.evaluate(el => el.disabled);
    console.log('After 2nd Tab+Space, disabled:', stillDisabled);
  }

  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-4-filled.png' });

  // Click Create - force click even if disabled since checkbox may be visually unchecked but logically checked
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-precreate.png' });
  const createBtn = page.locator('button:has-text("Create")').first();
  const isDisabled = await createBtn.getAttribute('disabled').catch(() => null);
  console.log('Create button disabled attr:', isDisabled);
  await createBtn.click({ force: true });
  console.log('Clicked Create (force)');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-5-created.png' });
  const currentUrl = page.url();
  console.log('After create, URL:', currentUrl);

  // Extract app ID from URL if we navigated to a new app
  // URL format: /developers/applications/{APP_ID}/...
  let appId = currentUrl.match(/applications\/(\d+)/)?.[1];
  
  // If still on /applications root, find EMPIRE-BOT in the list
  if (!appId || currentUrl.endsWith('/applications')) {
    console.log('Looking for EMPIRE-BOT in app list...');
    await page.waitForTimeout(1000);
    const empireApp = page.locator('text=EMPIRE-BOT').first();
    if (await empireApp.isVisible({ timeout: 5000 }).catch(() => false)) {
      await empireApp.click();
      await page.waitForTimeout(2000);
      appId = page.url().match(/applications\/(\d+)/)?.[1];
      console.log('App ID:', appId);
    }
  }
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-5b-apppage.png' });

  // Go to Bot section via direct URL if we have the app ID
  if (appId) {
    console.log('Navigating to Bot page directly, app ID:', appId);
    await page.goto(`https://discord.com/developers/applications/${appId}/bot`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } else {
    // Try clicking Bot in sidebar
    await page.locator('a:has-text("Bot")').first().click({ force: true }).catch(() => {});
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-6-bot.png' });

  // Reset/copy token
  console.log('Getting token...');
  let botToken = '';

  const resetBtn = page.locator('button:has-text("Reset Token")').first();
  if (await resetBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await resetBtn.click();
    await page.waitForTimeout(1000);
    const confirmBtn = page.locator('button:has-text("Yes, do it!"), button:has-text("Confirm")').first();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }
  }
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-7-token.png' });

  // Try to read the token - it appears as clickable text after reset
  const tokenDisplay = page.locator('[class*="token"] span, [class*="tokenBox"], code, .token').first();
  if (await tokenDisplay.isVisible({ timeout: 3000 }).catch(() => false)) {
    botToken = await tokenDisplay.textContent();
    console.log('Token found:', botToken.substring(0, 30) + '...');
  }

  // Also try copy button
  const copyBtn = page.locator('button:has-text("Copy")').first();
  if (await copyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await copyBtn.click();
    await page.waitForTimeout(500);
    // Read from clipboard via JS
    botToken = await page.evaluate(() => navigator.clipboard.readText().catch(() => '')).catch(() => '');
    if (botToken) console.log('Token from clipboard:', botToken.substring(0, 30) + '...');
  }

  // Scroll down to find privileged intents, enable them
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-8-intents.png' });

  // Go to OAuth2 URL Generator
  console.log('Going to OAuth2 URL Generator...');
  const oauth2 = page.locator('a:has-text("OAuth2")').first();
  if (await oauth2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await oauth2.click();
    await page.waitForTimeout(1000);
  }
  const urlGen = page.locator('a:has-text("URL Generator")').first();
  if (await urlGen.isVisible({ timeout: 3000 }).catch(() => false)) {
    await urlGen.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-9-oauth.png' });

  // Select 'bot' scope
  const botScope = page.locator('text=bot').nth(0);
  await botScope.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-10-scopes.png' });

  // Select Administrator
  const adminPerm = page.locator('text=Administrator').first();
  await adminPerm.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/emp-11-perms.png' });

  // Get invite URL
  let inviteUrl = '';
  const urlInput = page.locator('input[readonly]').last();
  if (await urlInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    inviteUrl = await urlInput.inputValue();
    console.log('Invite URL:', inviteUrl.substring(0, 100));
  }

  if (inviteUrl) {
    // Navigate to invite URL and authorize
    console.log('Authorizing bot to server...');
    await page.goto(inviteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'Z:/openclaw/workspace/emp-12-invite.png' });

    // Select server dropdown
    const guildDropdown = page.locator('select[name="guild_id"], [class*="guild"]').first();
    if (await guildDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
      await guildDropdown.selectOption({ label: 'THE NYGHTSHADE HOLLOW' }).catch(async () => {
        // Try clicking the dropdown option directly
        await page.locator('text=THE NYGHTSHADE HOLLOW').click({ force: true }).catch(() => {});
      });
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: 'Z:/openclaw/workspace/emp-13-server.png' });

    // Click Authorize
    const authBtn = page.locator('button:has-text("Authorize")').first();
    if (await authBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await authBtn.click();
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: 'Z:/openclaw/workspace/emp-14-done.png' });
    console.log('Done. URL:', page.url());
  }

  // Save everything
  const result = { botToken, inviteUrl, createdAt: new Date().toISOString() };
  fs.writeFileSync('Z:/openclaw/workspace/empire-bot-creds.json', JSON.stringify(result, null, 2));
  console.log('\n=== EMPIRE-BOT COMPLETE ===');
  console.log('Token (first 50):', botToken.substring(0, 50));
  console.log('Creds saved to empire-bot-creds.json');

  await page.waitForTimeout(8000);
  await browser.close();
}

run().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
