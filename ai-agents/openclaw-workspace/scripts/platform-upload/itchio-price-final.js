import { chromium } from 'playwright';

const b = await chromium.launchPersistentContext('C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data', {
  headless: false, 
  channel: 'msedge', 
  slowMo: 500,
  args: ['--no-sandbox'],
  viewport: { width: 1280, height: 900 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0'
});

const p = await b.newPage();

// First go to dashboard to verify session
await p.goto('https://itch.io/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
await p.waitForTimeout(3000);
console.log('Dashboard URL:', p.url(), '| Title:', await p.title());
await p.screenshot({ path: 'Z:/openclaw/workspace/itchio-dash.png' });

// Navigate to the edit page
console.log('Going to game 4379091 edit...');
await p.goto('https://itch.io/dashboard/game/4379091/edit', { waitUntil: 'domcontentloaded', timeout: 30000 });
await p.waitForTimeout(5000);
console.log('Edit URL:', p.url(), '| Title:', await p.title());
await p.screenshot({ path: 'Z:/openclaw/workspace/itchio-edit2.png', fullPage: false });

// If we got in, find the price
if (!p.url().includes('404') && await p.title() !== 'itch.io') {
  // Find price field
  const price = p.locator('input[name="minimum_price"]').first();
  if (await price.isVisible({ timeout: 5000 }).catch(() => false)) {
    await price.click({ clickCount: 3 });
    await price.fill('27');
    console.log('Price set to 27');
    
    // Save
    const save = p.locator('input[type="submit"][value*="Save"], button:has-text("Save")').first();
    if (await save.isVisible({ timeout: 3000 }).catch(() => false)) {
      await save.click();
      await p.waitForTimeout(3000);
      console.log('SAVED');
    }
  }
}

await p.screenshot({ path: 'Z:/openclaw/workspace/itchio-final.png' });
await p.waitForTimeout(8000);
await b.close();
