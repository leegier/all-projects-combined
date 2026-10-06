/**
 * itchio-set-price-v2.js — Set price on itch.io via Chromium (no Edge, no persistent context)
 * Usage: node --input-type=module itchio-set-price-v2.js --game-id=4420990 --price=19
 */
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

chromium.use(StealthPlugin());

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.join('=')];
  })
);

const GAME_ID = args['game-id'] || '4420990';
const PRICE = args['price'] || '19';
const CREDS = JSON.parse(fs.readFileSync('Z:/openclaw/workspace/credentials.json', 'utf8'));
const EMAIL = CREDS.platforms.itchio.email;
const PASSWORD = CREDS.platforms.itchio.password;

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  log('Navigating to itch.io login...');
  await page.goto('https://itch.io/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const loginForm = await page.locator('form input[name="username"]').isVisible({ timeout: 5000 }).catch(() => false);
  if (!loginForm) {
    log('ERROR: Login form not found — Cloudflare may be blocking. Check screenshot.');
    await page.screenshot({ path: 'Z:/openclaw/workspace/itchio-login-html-v2.png' });
    await browser.close();
    process.exit(1);
  }

  await page.fill('input[name="username"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  if (page.url().includes('/login')) {
    // Try with username
    await page.fill('input[name="username"]', 'THE-FORGE-IDE-GAMEDEV');
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  log(`Logged in. URL: ${page.url()}`);

  log(`Navigating to game ${GAME_ID} edit page...`);
  await page.goto(`https://itch.io/dashboard/game/${GAME_ID}/edit`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `Z:/openclaw/workspace/itchio-edit-${GAME_ID}.png` });

  log(`Edit page URL: ${page.url()}`);

  // Set to paid
  const paidOption = page.locator('input[value="paid"]').first();
  if (await paidOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    await paidOption.click();
    await page.waitForTimeout(1000);
    log('Set to paid');
  }

  // Set minimum price
  const priceInput = page.locator('input[name="minimum_price"]').first();
  if (await priceInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await priceInput.click({ clickCount: 3 });
    await priceInput.fill(PRICE);
    log(`Price filled: ${PRICE}`);
  } else {
    log('ERROR: Price input not found. Check screenshot.');
    await page.screenshot({ path: `Z:/openclaw/workspace/itchio-no-price-${GAME_ID}.png` });
    await browser.close();
    process.exit(1);
  }

  // Save
  const saveBtn = page.locator('input[type="submit"][value*="Save"], button:has-text("Save & view page"), button:has-text("Save")').first();
  await saveBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `Z:/openclaw/workspace/itchio-saved-${GAME_ID}.png` });

  log(`✅ Done. Final URL: ${page.url()}`);
  await browser.close();
}

run().catch(async e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
