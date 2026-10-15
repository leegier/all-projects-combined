/**
 * itchio-fix-price.js — Set game 4379091 price to $27 using real Edge profile
 */
import { chromium } from 'playwright';

const REAL_PROFILE = 'C:\\Users\\Gierl\\AppData\\Local\\Microsoft\\Edge\\User Data';
const GAME_ID = '4379091';
const TARGET_PRICE = '27';

async function run() {
  console.log('Launching Edge with real profile...');
  const browser = await chromium.launchPersistentContext(REAL_PROFILE, {
    headless: true,
    channel: 'msedge',
    slowMo: 400,
    viewport: { width: 1280, height: 900 },
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  console.log('Going to itch.io edit page...');
  await page.goto(`https://itch.io/dashboard/game/${GAME_ID}/edit`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/itchio-edit-loaded.png' });
  console.log('URL:', page.url());

  // Check if logged in
  if (page.url().includes('login') || page.url().includes('register')) {
    console.log('Not logged in!');
    await browser.close();
    process.exit(1);
  }

  // Find the price input - itch.io uses input for minimum price
  const priceSelectors = [
    'input[name="minimum_price"]',
    'input[id*="price"]',
    'input[placeholder*="price" i]',
    '.paid_status input[type="text"]',
    'input[data-price]',
  ];

  let priceSet = false;
  for (const sel of priceSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found price input via:', sel);
      await el.click({ clickCount: 3 });
      await el.fill(TARGET_PRICE);
      await page.waitForTimeout(300);
      const val = await el.inputValue();
      console.log('Price set to:', val);
      priceSet = true;
      break;
    }
  }

  if (!priceSet) {
    // Dump all inputs
    const inputs = await page.locator('input[type="text"], input[type="number"]').all();
    console.log('All text/number inputs:');
    for (const inp of inputs) {
      const name = await inp.getAttribute('name');
      const id = await inp.getAttribute('id');
      const val = await inp.inputValue().catch(() => '');
      console.log(`  name=${name} id=${id} value=${val}`);
    }
    await page.screenshot({ path: 'Z:/openclaw/workspace/itchio-noprice-debug.png' });
  }

  await page.screenshot({ path: 'Z:/openclaw/workspace/itchio-price-set.png' });

  // Save
  const saveBtn = page.locator('input[type="submit"], button[type="submit"], button:has-text("Save")').first();
  if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Clicking Save...');
    await saveBtn.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'Z:/openclaw/workspace/itchio-saved.png' });
    console.log('Saved. URL:', page.url());
  } else {
    console.log('No save button found');
    await page.screenshot({ path: 'Z:/openclaw/workspace/itchio-nosave.png' });
  }

  console.log('Done.');
  await page.waitForTimeout(5000);
  await browser.close();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
