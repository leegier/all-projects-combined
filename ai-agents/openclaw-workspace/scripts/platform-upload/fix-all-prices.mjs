import { chromium } from 'playwright';
import https from 'https';

const PRICES = [
  { id: 4420990, price: '299', label: 'CLAWED' },   // $2.99
  { id: 4379094, price: '19', label: 'AI Prompt Vault' },  // $19.00
];

const b = await chromium.launchPersistentContext('C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data', {
  headless: false, channel: 'msedge', slowMo: 300, args: ['--no-sandbox'],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0'
});

const p = await b.newPage();

for (const { id, price, label } of PRICES) {
  console.log(`\nSetting ${label} (${id}) to $${price}...`);
  await p.goto(`https://itch.io/game/edit/${id}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(4000);
  
  const priceInput = p.locator('input[name="game[min_price]"]').first();
  if (await priceInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    const current = await priceInput.inputValue();
    console.log(`  Current: ${current}`);
    await priceInput.click({ clickCount: 3 });
    await priceInput.fill(price);
    await p.waitForTimeout(500);
    console.log(`  Set to: ${await priceInput.inputValue()}`);
    
    await p.evaluate(() => {
      const btns = [...document.querySelectorAll('button.save_btn, button[type="submit"]')];
      if (btns[0]) btns[0].click();
    });
    await p.waitForTimeout(3000);
    console.log(`  Saved. URL: ${p.url()}`);
  } else {
    console.log(`  Price input not found for ${label}`);
  }
}

// Verify all prices
await new Promise(resolve => {
  https.get({ hostname: 'itch.io', path: '/api/1/8lzxDRwhgUvCp1WeiooJS6fkFmu4xWjjHv7O6BFb/my-games', headers: { 'User-Agent': 'MAX' } }, res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => {
      console.log('\n=== FINAL PRICES ===');
      JSON.parse(d).games.forEach(g => console.log(`${g.title}: $${(g.min_price/100).toFixed(2)}`));
      resolve();
    });
  });
});

await b.close();
