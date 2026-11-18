/**
 * devto-signup.js — Register maxgier2026@gmail.com on dev.to and get API key
 * dev.to uses GitHub/Twitter OAuth or email signup via their web form
 * After signup, API key is at: https://dev.to/settings/extensions
 */
import { chromium } from 'playwright';
import fs from 'fs';

const EMAIL = 'maxgier2026@gmail.com';
const PASSWORD = 'Gameover2026!!';
const AUTH_FILE = 'auth-devto.json';

async function run() {
  const hasSaved = fs.existsSync(AUTH_FILE);
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = hasSaved
    ? await browser.newContext({ storageState: AUTH_FILE })
    : await browser.newContext();
  const page = await context.newPage();

  if (!hasSaved) {
    console.log('Signing up on dev.to...');
    await page.goto('https://dev.to/enter?state=new-user', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'Z:/openclaw/workspace/devto-signup.png' });

    // Look for email signup option
    const emailBtn = page.locator('a:has-text("Sign up with Email"), button:has-text("Sign up with Email"), a[href*="email"]').first();
    if (await emailBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailBtn.click();
      await page.waitForTimeout(1500);
    }

    // Fill signup form
    const emailInput = page.locator('input[name="user[email]"], input[type="email"], input[placeholder*="email" i]').first();
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill(EMAIL);
    }

    const usernameInput = page.locator('input[name="user[username]"], input[placeholder*="username" i]').first();
    if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usernameInput.fill('maxgier2026');
    }

    const passInput = page.locator('input[type="password"]').first();
    if (await passInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await passInput.fill(PASSWORD);
    }

    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(4000);
    }

    console.log('After signup:', page.url());
    await page.screenshot({ path: 'Z:/openclaw/workspace/devto-after-signup.png' });

    // Try Google OAuth instead if email form didn't work
    if (page.url().includes('enter') || page.url().includes('login')) {
      console.log('Trying Google OAuth...');
      const googleBtn = page.locator('a:has-text("Continue with Google"), button:has-text("Google")').first();
      if (await googleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        const [popup] = await Promise.all([
          page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null),
          googleBtn.click()
        ]);
        if (popup) {
          console.log('Google popup opened. Complete login...');
          await popup.waitForEvent('close', { timeout: 300000 }).catch(() => {});
        }
        // Poll for successful login
        const deadline = Date.now() + 120000;
        while (Date.now() < deadline) {
          const url = page.url();
          if (!url.includes('enter') && !url.includes('login') && url.includes('dev.to')) {
            console.log('Logged in:', url);
            break;
          }
          await page.waitForTimeout(2000);
        }
      }
    }

    await context.storageState({ path: AUTH_FILE });
    console.log('Session saved');
  }

  // Get API key from settings
  console.log('Getting API key...');
  await page.goto('https://dev.to/settings/extensions', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/devto-settings.png' });

  // Generate new API key
  const keyNameInput = page.locator('input#api-key-description, input[placeholder*="key" i], input[id*="key"]').first();
  if (await keyNameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await keyNameInput.fill('MAX-agent');
    const genBtn = page.locator('button:has-text("Generate"), input[value*="Generate"]').first();
    if (await genBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await genBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  // Grab any API key visible on page
  const keyEl = page.locator('.api-key, code, .key-value, input[readonly]').first();
  let apiKey = '';
  if (await keyEl.isVisible({ timeout: 5000 }).catch(() => false)) {
    apiKey = await keyEl.inputValue().catch(() => keyEl.textContent());
    console.log('API KEY:', apiKey);
  }

  await page.screenshot({ path: 'Z:/openclaw/workspace/devto-apikey.png' });

  if (apiKey) {
    // Save to credentials
    const creds = JSON.parse(fs.readFileSync('Z:/openclaw/workspace/credentials.json', 'utf8'));
    creds.platforms.devto = { email: EMAIL, apiKey, username: 'maxgier2026' };
    fs.writeFileSync('Z:/openclaw/workspace/credentials.json', JSON.stringify(creds, null, 2));
    console.log('API key saved to credentials.json');
  }

  await page.waitForTimeout(5000);
  await browser.close();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
