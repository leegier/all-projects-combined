/**
 * create-empire-bot.js — Create EMPIRE-BOT Discord application autonomously
 * Uses Edge with temp profile, logs into Discord developer portal
 */
import { chromium } from 'playwright';
import fs from 'fs';

const EMAIL = 'leegier6@gmail.com';
const PASSWORD = 'Gameover2026!!';
const AUTH_FILE = 'auth-discord-dev.json';

async function run() {
  const hasSaved = fs.existsSync(AUTH_FILE);
  const userDataDir = 'C:\\Users\\Gierl\\AppData\\Local\\Temp\\playwright-discord-dev';
  
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'msedge',
    slowMo: 400,
    viewport: { width: 1280, height: 900 },
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  // Go to Discord developer portal
  console.log('Opening Discord developer portal...');
  await page.goto('https://discord.com/developers/applications', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-1.png' });
  console.log('URL:', page.url());

  // Log in if needed
  if (page.url().includes('login')) {
    console.log('Need to log in...');
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-login.png' });
    console.log('After login:', page.url());
  }

  // Wait for portal to load
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-2.png' });

  // Dismiss any welcome modal
  console.log('Checking for welcome modal...');
  const logInBtn = page.locator('button:has-text("Log In"), a:has-text("Log In")').first();
  if (await logInBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Welcome modal found — clicking Log In');
    await logInBtn.click();
    await page.waitForTimeout(3000);
    // Fill login
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill(EMAIL);
      await page.fill('input[name="password"], input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-afterlogin.png' });
      console.log('After login:', page.url());
    }
  }
  // Dismiss any remaining modal by pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Click "New Application"
  console.log('Creating new application...');
  const newAppBtn = page.locator('button:has-text("New Application"), [class*="createButton"]').first();
  await newAppBtn.waitFor({ timeout: 10000 });
  await newAppBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-newapp.png' });

  // Fill in app name
  const nameInput = page.locator('input[placeholder*="name" i], input[id*="app-name"], input[maxlength]').first();
  await nameInput.waitFor({ timeout: 5000 });
  await nameInput.fill('EMPIRE-BOT');
  await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-naming.png' });

  // Accept terms if shown
  const termsCheck = page.locator('input[type="checkbox"]').first();
  if (await termsCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
    await termsCheck.click();
  }

  // Click Create
  const createBtn = page.locator('button:has-text("Create"), button[type="submit"]').first();
  await createBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-created.png' });
  console.log('App created. URL:', page.url());

  // Navigate to Bot section
  console.log('Going to Bot section...');
  const botNav = page.locator('a:has-text("Bot"), [href*="/bot"]').first();
  await botNav.waitFor({ timeout: 5000 });
  await botNav.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-bot.png' });

  // Click Add Bot
  const addBotBtn = page.locator('button:has-text("Add Bot"), button:has-text("Yes, do it!")').first();
  if (await addBotBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addBotBtn.click();
    await page.waitForTimeout(1500);
    // Confirm dialog
    const confirmBtn = page.locator('button:has-text("Yes, do it!"), button:has-text("Confirm")').first();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }
  }
  await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-botadded.png' });

  // Reset token to get it
  console.log('Getting bot token...');
  const resetTokenBtn = page.locator('button:has-text("Reset Token"), button:has-text("Copy")').first();
  let botToken = '';
  if (await resetTokenBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await resetTokenBtn.click();
    await page.waitForTimeout(1500);
    // Confirm reset
    const confirmReset = page.locator('button:has-text("Yes, do it!"), button:has-text("Confirm")').first();
    if (await confirmReset.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmReset.click();
      await page.waitForTimeout(2000);
    }
    // Copy the token
    const tokenEl = page.locator('[class*="token"], input[readonly], code').first();
    botToken = await tokenEl.inputValue().catch(() => tokenEl.textContent().catch(() => ''));
    console.log('TOKEN (partial):', botToken.substring(0, 30) + '...');
  }
  await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-token.png' });

  // Enable Administrator permission (Privileged Gateway Intents)
  console.log('Setting permissions...');
  // Enable Administrator intent
  const adminPerm = page.locator('label:has-text("Administrator"), input[id*="administrator"]').first();
  if (await adminPerm.isVisible({ timeout: 3000 }).catch(() => false)) {
    await adminPerm.click();
  }

  // Go to OAuth2 > URL Generator
  console.log('Going to OAuth2 URL Generator...');
  const oauth2Nav = page.locator('a:has-text("OAuth2"), [href*="oauth2"]').first();
  await oauth2Nav.click();
  await page.waitForTimeout(1500);
  const urlGenNav = page.locator('a:has-text("URL Generator"), [href*="url-generator"]').first();
  if (await urlGenNav.isVisible({ timeout: 3000 }).catch(() => false)) {
    await urlGenNav.click();
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-oauth2.png' });

  // Check 'bot' scope
  const botScope = page.locator('label:has-text("bot"), input[value="bot"]').first();
  if (await botScope.isVisible({ timeout: 3000 }).catch(() => false)) {
    await botScope.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-scopes.png' });

  // Check Administrator in bot permissions
  const adminPermission = page.locator('label:has-text("Administrator")').first();
  if (await adminPermission.isVisible({ timeout: 3000 }).catch(() => false)) {
    await adminPermission.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-botperms.png' });

  // Copy invite URL
  const inviteUrlEl = page.locator('input[readonly][value*="discord.com/api/oauth2"]').first();
  let inviteUrl = '';
  if (await inviteUrlEl.isVisible({ timeout: 5000 }).catch(() => false)) {
    inviteUrl = await inviteUrlEl.inputValue();
    console.log('INVITE URL:', inviteUrl);
  }
  await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-inviteurl.png' });

  // Navigate to invite URL and authorize
  if (inviteUrl) {
    console.log('Navigating to invite URL...');
    await page.goto(inviteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-authorize1.png' });

    // Select server
    const serverSelect = page.locator('select, [class*="guild"], [aria-label*="server" i]').first();
    if (await serverSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await serverSelect.selectOption({ label: 'THE NYGHTSHADE HOLLOW' });
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-authorize2.png' });

    // Click Authorize
    const authBtn = page.locator('button:has-text("Authorize"), button[type="submit"]').first();
    if (await authBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await authBtn.click();
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: 'Z:/openclaw/workspace/devportal-authorized.png' });
    console.log('Authorization done. URL:', page.url());
  }

  // Save results
  const results = { botToken, inviteUrl, timestamp: new Date().toISOString() };
  fs.writeFileSync('Z:/openclaw/workspace/empire-bot-creds.json', JSON.stringify(results, null, 2));
  console.log('\n=== RESULTS ===');
  console.log('Token saved to: Z:/openclaw/workspace/empire-bot-creds.json');
  console.log('Token (first 40):', botToken.substring(0, 40));
  console.log('Invite URL:', inviteUrl.substring(0, 80));

  await page.waitForTimeout(5000);
  await browser.close();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
