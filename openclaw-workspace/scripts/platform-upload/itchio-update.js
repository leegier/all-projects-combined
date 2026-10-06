/**
 * itchio-update.js — Update CLAWED: set price $2.99, add description
 */
import { chromium } from 'playwright';
import fs from 'fs';

const USERNAME = 'THE-FORGE-IDE-GAMEDEV';
const PASSWORD = 'Gameover2026!!';
const GAME_ID = '4420990';
const AUTH_FILE = 'auth-itchio.json';

const DESCRIPTION = `CLAWED is a tactical stealth-survival game. You're a prisoner. The guards are smart. Your only weapon is the environment.

ALPHA v0.1 INCLUDES:
• Reactive guard AI — patrol, suspicious, chase, attack states
• Inventory system with item interaction  
• Stamina, hunger, and health mechanics
• Stealth system with noise and visibility detection
• Handcrafted prison level

CONTROLS: WASD + Mouse | E to interact | Shift to sprint | Tab for inventory

Early alpha — buy now at the lowest price it will ever be.`;

async function run() {
  const hasSaved = fs.existsSync(AUTH_FILE);
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = hasSaved
    ? await browser.newContext({ storageState: AUTH_FILE })
    : await browser.newContext();
  const page = await context.newPage();

  if (!hasSaved) {
    console.log('Loading itch.io login...');
    await page.goto('https://itch.io/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for ANY input to appear (JS-rendered form)
    await page.waitForSelector('input', { timeout: 20000 });
    await page.waitForTimeout(2000);
    
    // Screenshot to see what we have
    await page.screenshot({ path: 'Z:/openclaw/workspace/itchio-login-page.png' });
    
    // Try all possible selectors for username/email field
    const userSelectors = [
      'input[name="username"]',
      'input[id="login_username"]', 
      'input[placeholder*="username" i]',
      'input[placeholder*="email" i]',
      'input[type="text"]',
      'input[type="email"]',
    ];
    
    let filled = false;
    for (const sel of userSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Found username field:', sel);
        await el.fill(USERNAME);
        filled = true;
        break;
      }
    }
    
    if (!filled) {
      console.log('No login form found. Dumping page HTML...');
      const html = await page.content();
      fs.writeFileSync('Z:/openclaw/workspace/itchio-login-html.txt', html.substring(0, 3000));
      throw new Error('Could not find login form. Check itchio-login-html.txt');
    }

    // Password
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
    
    const url = page.url();
    console.log('After login:', url);
    
    await context.storageState({ path: AUTH_FILE });
    console.log('Session saved');
  }

  // Navigate to edit page
  console.log('Going to game edit page...');
  await page.goto(`https://itch.io/dashboard/game/${GAME_ID}/edit`, {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/itchio-edit-page.png' });
  console.log('Edit page:', page.url());

  // Set price
  const priceEl = page.locator('input[name="minimum_price"]').first();
  if (await priceEl.isVisible({ timeout: 5000 }).catch(() => false)) {
    await priceEl.click({ clickCount: 3 });
    await priceEl.fill('2.99');
    console.log('✓ Price set to $2.99');
  } else {
    console.log('Price field not visible yet, waiting...');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'Z:/openclaw/workspace/itchio-edit-wait.png' });
  }

  // Description - itch.io uses a textarea or rich editor
  const descEl = page.locator('textarea[name="description"]').first();
  if (await descEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    await descEl.fill(DESCRIPTION);
    console.log('✓ Description filled');
  }

  // Save
  const saveBtn = page.locator('input[type="submit"][value*="Save"], button:has-text("Save")').first();
  if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(3000);
    console.log('✓ Saved');
  }

  await page.screenshot({ path: 'Z:/openclaw/workspace/itchio-done.png' });
  console.log('DONE — https://the-forge-ide-gamedev.itch.io/clawed');
  await page.waitForTimeout(4000);
  await browser.close();
}

run().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
