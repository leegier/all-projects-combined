import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authPath = path.join(__dirname, 'auth-devto.json');
const apiKeyPath = 'Z:/openclaw/workspace/devto-api-key.txt';
const resultsPath = 'Z:/openclaw/workspace/devto-posts.txt';

const storageState = JSON.parse(readFileSync(authPath, 'utf8'));
console.log('Loaded storageState, cookies:', storageState.cookies.length);

async function getApiKey() {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/Gierl/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe',
    headless: true,
  });
  // Create context WITHOUT storageState, then add cookies manually
  const context = await browser.newContext();
  // Add cookies manually
  await context.addCookies(storageState.cookies);
  const page = await context.newPage();
  console.log('Navigating to settings/extensions...');
  await page.goto('https://dev.to/settings/extensions', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: 'Z:/openclaw/workspace/devto-extensions2.png' });
  const title = await page.title();
  console.log('Page title:', title);
  const url = page.url();
  console.log('URL:', url);

  let apiKey = null;
  try {
    // Wait for settings page to load
    await page.waitForSelector('h1, h2, h3', { timeout: 10000 });
    const heading = await page.locator('h1, h2').first().textContent();
    console.log('Heading:', heading);

    // Look for API key input description field
    const inputs = await page.locator('input').all();
    console.log('Inputs found:', inputs.length);
    for (let i = 0; i < Math.min(inputs.length, 10); i++) {
      const ph = await inputs[i].getAttribute('placeholder').catch(() => '');
      const id = await inputs[i].getAttribute('id').catch(() => '');
      const name = await inputs[i].getAttribute('name').catch(() => '');
      console.log('Input', i, '| placeholder:', ph, '| id:', id, '| name:', name);
    }
  } catch(e) {
    console.log('Error on settings page:', e.message);
  }

  await browser.close();
  return apiKey;
}

getApiKey().catch(e => { console.error('Fatal:', e.message); process.exit(1); });