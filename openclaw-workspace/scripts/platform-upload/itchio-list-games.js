import { chromium } from 'playwright';

const b = await chromium.launchPersistentContext('C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data', {
  headless: true, channel: 'msedge', args: ['--no-sandbox']
});
const p = await b.newPage();
await p.goto('https://itch.io/dashboard/games', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(3000);

console.log('Games page title:', await p.title());

// Get all game links
const games = await p.evaluate(() => {
  return [...document.querySelectorAll('a[href*="/dashboard/game/"]')].map(a => ({
    href: a.href,
    text: a.textContent?.trim()?.substring(0, 60)
  }));
});
console.log('Games found:', JSON.stringify(games, null, 2));

// Also get any game IDs from the page
const ids = await p.evaluate(() => {
  const matches = document.body.innerHTML.match(/\/dashboard\/game\/(\d+)/g);
  return [...new Set(matches || [])];
});
console.log('Game IDs on page:', ids);

await p.screenshot({ path: 'Z:/openclaw/workspace/itchio-games-list.png' });
await b.close();
