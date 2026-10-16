import { chromium } from 'playwright';

const b = await chromium.launchPersistentContext('C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data', {
  headless: true, channel: 'msedge', args: ['--no-sandbox']
});
const p = await b.newPage();
await p.goto('https://itch.io/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 });
await p.waitForTimeout(3000);
console.log('URL:', p.url());
console.log('Title:', await p.title());
const user = await p.locator('.user_name, [class*="username"]').first().textContent().catch(() => 'not found');
console.log('User:', user);
// Check if games are accessible
await p.goto('https://itch.io/dashboard/game/4379091/edit', { waitUntil: 'domcontentloaded', timeout: 20000 });
await p.waitForTimeout(2000);
console.log('Game edit URL:', p.url());
console.log('Game edit title:', await p.title());
await b.close();
