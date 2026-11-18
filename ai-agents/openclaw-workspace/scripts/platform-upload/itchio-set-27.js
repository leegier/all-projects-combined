import { chromium } from 'playwright';

const b = await chromium.launchPersistentContext('C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data', {
  headless: false, channel: 'msedge', slowMo: 300, args: ['--no-sandbox'],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0'
});

const p = await b.newPage();
await p.goto('https://itch.io/game/edit/4379091', { waitUntil: 'domcontentloaded', timeout: 20000 });
await p.waitForTimeout(4000);
console.log('URL:', p.url());

// Set price
const priceInput = p.locator('input[name="game[min_price]"]').first();
const currentPrice = await priceInput.inputValue();
console.log('Current price:', currentPrice);

await priceInput.click({ clickCount: 3 });
await priceInput.fill('2700'); // itch.io stores prices in cents
await p.waitForTimeout(300);
const newVal = await priceInput.inputValue();
console.log('New value entered:', newVal);

await p.screenshot({ path: 'Z:/openclaw/workspace/itchio-price27-set.png' });

// Click Save
const saveBtn = p.locator('input[type="submit"][value*="Save"], button[type="submit"]').first();
const saveBtnAlt = p.locator('.save_button, input[value="Save & view page"], input[value*="Save"]').first();

let saved = false;
if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  const val = await saveBtn.getAttribute('value') || await saveBtn.textContent();
  console.log('Save button text:', val);
  await saveBtn.click();
  saved = true;
} else if (await saveBtnAlt.isVisible({ timeout: 3000 }).catch(() => false)) {
  await saveBtnAlt.click();
  saved = true;
} else {
  // Find any submit button
  const submits = await p.locator('input[type="submit"]').all();
  console.log('Submit buttons:');
  for (const s of submits) {
    const v = await s.getAttribute('value');
    console.log(' -', v);
    if (v?.includes('Save')) {
      await s.click();
      saved = true;
      break;
    }
  }
}

if (saved) {
  await p.waitForTimeout(4000);
  console.log('Saved! URL:', p.url());
}

await p.screenshot({ path: 'Z:/openclaw/workspace/itchio-price27-done.png' });

// Verify by checking the API
await p.waitForTimeout(3000);
await b.close();

// Verify with butler API
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const https = require('https');
const key = '8lzxDRwhgUvCp1WeiooJS6fkFmu4xWjjHv7O6BFb';
await new Promise(resolve => {
  https.get({hostname:'itch.io',path:'/api/1/'+key+'/my-games',headers:{'User-Agent':'MAX'}}, res => {
    let d=''; res.on('data',c=>d+=c);
    res.on('end',()=>{
      const g = JSON.parse(d).games;
      g.forEach(x => {
        if (x.id === 4379091) console.log('BRAXTON price now: $'+(x.min_price/100).toFixed(2));
      });
      resolve();
    });
  });
});
