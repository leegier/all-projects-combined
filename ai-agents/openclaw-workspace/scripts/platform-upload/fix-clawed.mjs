import { chromium } from 'playwright';
import https from 'https';
const b = await chromium.launchPersistentContext('C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data', {
  headless: false, channel: 'msedge', slowMo: 300, args: ['--no-sandbox'],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0'
});
const p = await b.newPage();
await p.goto('https://itch.io/game/edit/4420990', { waitUntil: 'domcontentloaded', timeout: 20000 });
await p.waitForTimeout(4000);
const price = p.locator('input[name="game[min_price]"]').first();
await price.click({ clickCount: 3 });
await price.fill('2.99');
await p.waitForTimeout(500);
console.log('Set to:', await price.inputValue());
await p.evaluate(() => { document.querySelector('button.save_btn')?.click(); });
await p.waitForTimeout(3000);
await new Promise(r => { https.get({hostname:'itch.io',path:'/api/1/8lzxDRwhgUvCp1WeiooJS6fkFmu4xWjjHv7O6BFb/my-games',headers:{'User-Agent':'MAX'}}, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ JSON.parse(d).games.forEach(g=>console.log(g.title+': $'+(g.min_price/100).toFixed(2))); r(); }); }); });
await b.close();
