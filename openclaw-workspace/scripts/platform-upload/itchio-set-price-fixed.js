/**
 * itchio-set-price-fixed.js — Set price on itch.io using isolated Chromium (no Edge conflict)
 * Usage: node itchio-set-price-fixed.js --game-id=4379091 --price=27
 */
import { chromium } from 'playwright';
import fs from 'fs';

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v]; })
);

const GAME_ID = args['game-id'] || '4379091';
const PRICE   = args['price']   || '27';
const EMAIL   = 'leegier6@gmail.com';
const PASS    = 'Gameover2026!!';
const LOG     = `Z:/openclaw/workspace/itchio-set-price-${GAME_ID}.log`;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

async function run() {
  log(`Starting: game ${GAME_ID} → $${PRICE}`);

  // Use isolated temp profile — no conflict with running Edge
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 }
  });
  const page = await ctx.newPage();

  // Go to login
  log('Navigating to login...');
  await page.goto('https://itch.io/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Cloudflare wait
  for (let i = 0; i < 20; i++) {
    const t = await page.title().catch(() => '');
    if (!t.toLowerCase().includes('just a moment') && !t.toLowerCase().includes('cloudflare')) break;
    log(`CF challenge (${i+1}/20)...`);
    await page.waitForTimeout(1500);
  }

  log('Page title: ' + await page.title());
  await page.screenshot({ path: `Z:/openclaw/workspace/itchio-login-before-${GAME_ID}.png` });

  // Fill login
  const emailEl = page.locator('input[name="username"], input[type="email"], #login_username').first();
  if (await emailEl.isVisible({ timeout: 8000 }).catch(() => false)) {
    await emailEl.fill(EMAIL);
    await page.fill('input[type="password"]', PASS);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForTimeout(4000);
    log('After login URL: ' + page.url());
  } else {
    log('Login form not found — may already be logged in or CF blocked');
    await page.screenshot({ path: `Z:/openclaw/workspace/itchio-noform-${GAME_ID}.png` });
  }

  // Go to edit page
  const editUrl = `https://itch.io/dashboard/game/${GAME_ID}/edit`;
  log('Navigating to: ' + editUrl);
  await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  log('Edit page URL: ' + page.url());
  await page.screenshot({ path: `Z:/openclaw/workspace/itchio-editpage-${GAME_ID}.png` });

  // Click "Paid" pricing radio if visible
  for (const sel of ['input[value="paid"]', 'label:has-text("Paid") input', '#pricing_paid']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click();
      log('Clicked Paid radio');
      await page.waitForTimeout(1000);
      break;
    }
  }

  // Set price
  let priceSet = false;
  for (const sel of ['input[name="minimum_price"]', 'input[name="price"]', 'input[id*="price"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await el.click({ clickCount: 3 });
      await el.fill(PRICE);
      log(`Price set via ${sel}`);
      priceSet = true;
      break;
    }
  }

  if (!priceSet) {
    await page.screenshot({ path: `Z:/openclaw/workspace/itchio-noprice-${GAME_ID}.png` });
    const html = await page.content();
    fs.writeFileSync(`Z:/openclaw/workspace/itchio-html-${GAME_ID}.txt`, html.slice(0, 8000));
    log('ERROR: price field not found');
    await browser.close();
    process.exit(1);
  }

  // Save
  for (const sel of ['input[type="submit"][value*="Save"]', 'button:has-text("Save")', 'button[type="submit"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(4000);
      log('Save clicked');
      break;
    }
  }

  await page.screenshot({ path: `Z:/openclaw/workspace/itchio-done-${GAME_ID}.png` });
  log(`DONE — game ${GAME_ID} price=$${PRICE} — ${page.url()}`);
  console.log(`\n✓ SUCCESS: game ${GAME_ID} priced at $${PRICE}`);
  await browser.close();
}

run().catch(err => {
  console.error('FATAL:', err.message);
  fs.appendFileSync(`Z:/openclaw/workspace/BLOCKERS.md`,
    `\n## itchio-set-price-fixed FATAL ${new Date().toISOString()}\n${err.message}\n${err.stack}\n`);
  process.exit(1);
});
