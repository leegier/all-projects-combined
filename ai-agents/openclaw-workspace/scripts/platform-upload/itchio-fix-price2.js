import { chromium } from 'playwright';

const b = await chromium.launchPersistentContext('C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data', {
  headless: false, channel: 'msedge', slowMo: 300, args: ['--no-sandbox'],
  viewport: { width: 1280, height: 900 }
});
const p = await b.newPage();
await p.goto('https://itch.io/dashboard/game/4379091/edit', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(5000);

// Dump the full page title + all form elements
console.log('Title:', await p.title());
console.log('URL:', p.url());

// Get all inputs including hidden ones
const allInputs = await p.evaluate(() => {
  return [...document.querySelectorAll('input,select,textarea')].map(el => ({
    tag: el.tagName,
    name: el.name,
    id: el.id,
    type: el.type,
    value: el.value?.substring(0,50),
    class: el.className?.substring(0,50)
  }));
});
console.log('All form elements:', JSON.stringify(allInputs, null, 2));

// Screenshot
await p.screenshot({ path: 'Z:/openclaw/workspace/itchio-full-edit.png', fullPage: true });
await b.close();
