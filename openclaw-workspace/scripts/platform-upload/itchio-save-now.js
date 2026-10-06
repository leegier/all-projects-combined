import { chromium } from 'playwright';

const b = await chromium.launchPersistentContext('C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data', {
  headless: false, channel: 'msedge', slowMo: 300, args: ['--no-sandbox'],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0'
});

const p = await b.newPage();
await p.goto('https://itch.io/game/edit/4379091', { waitUntil: 'domcontentloaded', timeout: 20000 });
await p.waitForTimeout(4000);

// Set price to 2700 cents = $27.00
const price = p.locator('input[name="game[min_price]"]').first();
await price.click({ clickCount: 3 });
await price.fill('2700');
await p.waitForTimeout(500);
console.log('Price:', await price.inputValue());

// Get all clickable elements that could be Save
const saveInfo = await p.evaluate(() => {
  const all = [...document.querySelectorAll('button, input[type="submit"], a')];
  return all
    .filter(el => (el.textContent || el.value || '').toLowerCase().includes('save'))
    .map(el => ({
      tag: el.tagName,
      type: el.type,
      text: el.textContent?.trim(),
      value: el.value,
      class: el.className,
      href: el.href
    }));
});
console.log('Save elements:', JSON.stringify(saveInfo, null, 2));

// Click by JS dispatch on the save button
const clicked = await p.evaluate(() => {
  const all = [...document.querySelectorAll('button, input[type="submit"], a, .button')];
  for (const el of all) {
    const text = (el.textContent || el.value || '').toLowerCase().trim();
    if (text === 'save' || text === 'save & view page' || text.startsWith('save')) {
      console.log('Clicking:', el.tagName, text);
      el.click();
      return el.tagName + ': ' + text;
    }
  }
  return 'not found';
});
console.log('Clicked:', clicked);

await p.waitForTimeout(4000);
console.log('Final URL:', p.url());
await p.screenshot({ path: 'Z:/openclaw/workspace/itchio-after-save.png' });

// Verify
const https = await import('https');
const key = '8lzxDRwhgUvCp1WeiooJS6fkFmu4xWjjHv7O6BFb';
await new Promise(resolve => {
  https.default.get({ hostname: 'itch.io', path: '/api/1/' + key + '/my-games', headers: { 'User-Agent': 'MAX' } }, res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => {
      const games = JSON.parse(d).games;
      const b = games.find(g => g.id === 4379091);
      if (b) console.log('BRAXTON price now: $' + (b.min_price / 100).toFixed(2));
      resolve();
    });
  });
});

await p.waitForTimeout(3000);
await b.close();
