import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authPath = path.join(__dirname, 'auth-devto.json');
const apiKeyPath = 'Z:/openclaw/workspace/devto-api-key.txt';
const resultsPath = 'Z:/openclaw/workspace/devto-posts.txt';

const storageState = JSON.parse(readFileSync(authPath, 'utf8'));
const cookieStr = storageState.cookies.map(c => c.name + '=' + c.value).join('; ');
console.log('Session loaded. Cookies:', storageState.cookies.length);

async function getApiKey(page) {
  console.log('Navigating to dev.to settings/extensions...');
  await page.goto('https://dev.to/settings/extensions', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  const title = await page.title();
  console.log('Page title:', title);
  await page.screenshot({ path: 'Z:/openclaw/workspace/devto-extensions.png' });
  try {
    const descInput = page.locator('input[placeholder*="description" i], #new-api-key-desc').first();
    await descInput.waitFor({ timeout: 6000 });
    await descInput.fill('max-bot');
    console.log('Filled description');
    const generateBtn = page.locator('button:has-text("Generate API Key"), button:has-text("Generate")').first();
    await generateBtn.click();
    console.log('Clicked generate');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'Z:/openclaw/workspace/devto-after-generate.png' });
    for (const sel of ['input[readonly]', '.generated-api-key', 'code', 'pre', '.api-key']) {
      try {
        const el = page.locator(sel).last();
        const val = await el.inputValue({ timeout: 1000 }).catch(() => el.textContent({ timeout: 1000 }));
        if (val && val.trim().length > 20) {
          console.log('Got API key:', val.trim().substring(0, 8) + '...');
          writeFileSync(apiKeyPath, val.trim());
          return val.trim();
        }
      } catch(e) {}
    }
  } catch(e) {
    console.log('Browser key fetch error:', e.message);
    await page.screenshot({ path: 'Z:/openclaw/workspace/devto-apikey-error.png' }).catch(()=>{});
  }
  return null;
}

async function postArticle(apiKey, article) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) { headers['api-key'] = apiKey; }
  else { headers['Cookie'] = cookieStr; }
  console.log('Posting:', article.title);
  const res = await fetch('https://dev.to/api/articles', {
    method: 'POST', headers,
    body: JSON.stringify({ article }),
  });
  const data = await res.json();
  console.log('Status:', res.status, data.url || JSON.stringify(data).substring(0, 300));
  return { status: res.status, data };
}

const articles = [
  {
    title: "I Spent One Week Building a Stealth Survival Game with Unity AI — Here's What Happened",
    tags: ['gamedev', 'unity', 'indiegames', 'csharp'],
    body_markdown: readFileSync(path.join(__dirname, 'article1.txt'), 'utf8'),
    published: true,
  },
  {
    title: '50 Claude & ChatGPT Prompts That Actually Work in Production (Free Sample + Full Pack)',
    tags: ['ai', 'productivity', 'chatgpt', 'programming'],
    body_markdown: readFileSync(path.join(__dirname, 'article2.txt'), 'utf8'),
    published: true,
  },
  {
    title: 'I Launched My SaaS Product to 22 Different Audiences at Once Using HTML Templates',
    tags: ['webdev', 'saas', 'marketing', 'html'],
    body_markdown: readFileSync(path.join(__dirname, 'article3.txt'), 'utf8'),
    published: true,
  },
];

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/Gierl/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe',
    headless: true,
  });
  const context = await browser.newContext({ storageState: authPath });
  const page = await context.newPage();
  let apiKey = null;
  try {
    apiKey = await getApiKey(page);
  } catch(e) {
    console.log('Browser error:', e.message);
  }
  await browser.close();
  if (!apiKey) { console.log('No API key from browser. Trying cookie auth.'); }
  const results = [];
  for (const article of articles) {
    const result = await postArticle(apiKey, article);
    results.push({ title: article.title, ...result });
    await new Promise(r => setTimeout(r, 1500));
  }
  const lines = results.map(r => {
    const url = (r.data && (r.data.url || r.data.canonical_url)) || 'ERROR (' + r.status + '): ' + JSON.stringify(r.data).substring(0, 200);
    return '[' + r.status + '] ' + r.title + "\n  URL: " + url;
  });
  const output = "=== DEV.TO POSTS ===\n" + lines.join("\n\n") + "\n\nPosted: " + new Date().toISOString();
  writeFileSync(resultsPath, output);
  console.log("\n=== FINAL RESULTS ===\n" + lines.join("\n\n"));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });