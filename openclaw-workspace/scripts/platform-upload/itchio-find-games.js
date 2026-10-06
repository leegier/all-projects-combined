import { chromium } from 'playwright';

const b = await chromium.launchPersistentContext('C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data', {
  headless: false, channel: 'msedge', slowMo: 200, args: ['--no-sandbox'],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0'
});

const p = await b.newPage();

// Go to the games list in dashboard
await p.goto('https://the-forge-ide-gamedev.itch.io/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await p.waitForTimeout(3000);
await p.screenshot({ path: 'Z:/openclaw/workspace/itchio-profile.png' });

const gameLinks = await p.evaluate(() => {
  return [...document.querySelectorAll('a[href*="itch.io"]')].map(a => a.href).filter(h => 
    !h.includes('dashboard') && h.includes('itch.io') && !h.includes('#')
  ).slice(0, 20);
});
console.log('Game links on profile:', gameLinks);

// Also check the dashboard directly  
await p.goto('https://itch.io/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 });
await p.waitForTimeout(3000);
await p.screenshot({ path: 'Z:/openclaw/workspace/itchio-dashboard.png', fullPage: true });

// Find all game edit links
const editLinks = await p.evaluate(() => {
  return [...document.querySelectorAll('a[href*="dashboard/game"]')].map(a => ({
    href: a.href,
    text: a.textContent?.trim()?.substring(0, 50)
  }));
});
console.log('Edit links:', JSON.stringify(editLinks));

await b.close();
