import { chromium } from 'playwright';
const b = await chromium.launchPersistentContext('C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data', {
  headless: false, channel: 'msedge', slowMo: 300, args: ['--no-sandbox'],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0'
});
const p = await b.newPage();
await p.goto('https://itch.io/game/edit/4379091', { waitUntil: 'domcontentloaded', timeout: 20000 });
await p.waitForTimeout(4000);
const price = p.locator('input[name="game[min_price]"]').first();
console.log('Current:', await price.inputValue());
await price.click({ clickCount: 3 });
await price.fill('27');
await p.waitForTimeout(500);
console.log('Set to:', await price.inputValue());
await p.evaluate(() => {
  const btns = [...document.querySelectorAll('button.save_btn')];
  if (btns[0]) btns[0].click();
});
await p.waitForTimeout(4000);
const https = await import('https');
const key = '8lzxDRwhgUvCp1WeiooJS6fkFmu4xWjjHv7O6BFb';
await new Promise(r => { https.default.get({hostname:'itch.io',path:'/api/1/'+key+'/my-games',headers:{'User-Agent':'MAX'}}, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ const g=JSON.parse(d).games; g.forEach(x=>{if(x.id===4379091)console.log('BRAXTON now: \$'+(x.min_price/100).toFixed(2))}); r(); }); }); });
await b.close();
