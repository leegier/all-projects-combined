import { chromium } from 'playwright';

const b = await chromium.launchPersistentContext('C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data', {
  headless: false, channel: 'msedge', slowMo: 400, args: ['--no-sandbox'],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0'
});

const p = await b.newPage();
await p.goto('https://itch.io/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 });
await p.waitForTimeout(3000);

// Find and click the Edit link for BRAXTON (game 4379091)
// The edit link shows in the dashboard - find the one near "BRAXTON"
const braxtonEdit = p.locator('a[href*="4379091"][href*="edit"]').first();
if (await braxtonEdit.isVisible({ timeout: 3000 }).catch(() => false)) {
  const href = await braxtonEdit.getAttribute('href');
  console.log('BRAXTON edit href:', href);
  await braxtonEdit.click();
} else {
  // Click the first "Edit" link near BRAXTON text
  const braxtonSection = p.locator(':has-text("BRAXTON")').first();
  const editLink = braxtonSection.locator('a:has-text("Edit")').first();
  if (await editLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    const href = await editLink.getAttribute('href');
    console.log('Edit link href:', href);
    await editLink.click();
  } else {
    // Get all edit links
    const allEdits = await p.locator('a:has-text("Edit")').all();
    for (const e of allEdits) {
      const href = await e.getAttribute('href');
      console.log('Edit link:', href);
    }
    // Click first one
    if (allEdits.length > 0) await allEdits[0].click();
  }
}

await p.waitForTimeout(3000);
console.log('After click URL:', p.url());
await p.screenshot({ path: 'Z:/openclaw/workspace/itchio-edit-real.png', fullPage: false });

// Now find the price input
const priceInput = p.locator('input[name="minimum_price"], input[name="min_price"]').first();
if (await priceInput.isVisible({ timeout: 5000 }).catch(() => false)) {
  const current = await priceInput.inputValue();
  console.log('Current price:', current);
  await priceInput.click({ clickCount: 3 });
  await priceInput.fill('27');
  console.log('Price set to 27');
  
  const save = p.locator('input[type="submit"], button[type="submit"]').first();
  if (await save.isVisible({ timeout: 3000 }).catch(() => false)) {
    await save.click();
    await p.waitForTimeout(3000);
    console.log('SAVED');
  }
} else {
  // Dump visible inputs
  const inputs = await p.locator('input').all();
  for (const inp of inputs) {
    const name = await inp.getAttribute('name');
    const type = await inp.getAttribute('type');
    if (type !== 'hidden') console.log('Input:', name, type);
  }
}

await p.screenshot({ path: 'Z:/openclaw/workspace/itchio-edit-done.png' });
await p.waitForTimeout(8000);
await b.close();
