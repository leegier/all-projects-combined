/**
 * gumroad-playwright.js — Upload products to Gumroad via browser automation
 * Run: node gumroad-playwright.js
 *
 * First run: visible browser — log in via Google, session saved.
 * All subsequent runs: headless.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const CREDS = JSON.parse(fs.readFileSync('Z:/openclaw/workspace/credentials.json', 'utf8'));
const EMAIL = CREDS.platforms.google.email;       // leegier6@gmail.com
const PASSWORD = CREDS.platforms.google.password;  // Gameover2026!!
const AUTH_STATE = path.resolve('auth-gumroad.json');

const PRODUCTS = [
  {
    name: 'FORGE Landing Page Template Pack — 22 Multi-Brand SaaS Pages',
    price: '29',
    description: `22 complete, standalone HTML landing pages — each with unique branding for a different marketing channel (Product Hunt, HN, Reddit, LinkedIn, Twitter, and more).

All 22 pages market the same product, positioned differently for each audience. Plug in your product name and deploy all 22 simultaneously.

What's included:
• 22 HTML files (no dependencies — pure HTML/CSS/JS)
• brands.config.json for bulk customization
• generate-brands.js — Node.js script to mass-customize all 22 pages at once
• MARKETING_STRATEGY.md — which channel to post each brand to
• MARKETING_PLAYBOOK.json — full launch playbook

Use case: Launch the same SaaS product to 22 different audiences simultaneously.`,
    zipPath: 'Z:/openclaw/workspace/gumroad-products/FORGE-Landing-Page-Pack-v1.zip',
  },
  {
    name: 'Autonomous Agent Startup Pack — Full OpenClaw Config + Agent Runtime',
    price: '49',
    description: `Complete configuration files, workspace templates, and a working autonomous agent runtime to deploy your own AI agent that runs 24/7, earns money, builds software, and posts to Discord/Telegram.

What's included:
• BRIEF.md — ultra-compact bootstrap prompt
• DIRECTIVES.md — agent standing orders and revenue mandate template
• SKILLS-GUIDE.md — 170+ skills with usage examples
• AGENTS.md — sub-agent team configuration
• PLATFORM_GIGS.md — copy-paste ready Fiverr/Upwork/itch.io/Gumroad listings
• agent-runtime/ — full Python async runtime: planner, DAG executor, SQLite persistence, orchestrator
• SETUP_GUIDE.md — 15-minute install guide

Tech stack: Python 3.11+, aiosqlite, aiohttp, Ollama, OpenClaw`,
    zipPath: 'Z:/openclaw/workspace/gumroad-products/Autonomous-Agent-Startup-Pack-v1.zip',
  },
];

async function isLoggedIn(page) {
  const url = page.url();
  return url.includes('app.gumroad.com') && !url.includes('login');
}

async function login(page) {
  console.log('→ Navigating to Gumroad login...');
  await page.goto('https://gumroad.com/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  console.log('  Current URL:', currentUrl);

  // Already logged in (redirected away from /login to dashboard or app)
  if (currentUrl.includes('gumroad.com') && !currentUrl.includes('login') && !currentUrl.includes('/auth/')) {
    console.log('✓ Already logged in to Gumroad');
    return;
  }

  console.log('  Clicking Google button...');
  const googleBtn = page.locator('button:has-text("Google"), a:has-text("Google"), [href*="google_oauth2"]').first();
  if (!(await googleBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    throw new Error('Could not find Google button on Gumroad login page');
  }

  // Start listening for a popup before clicking (some Gumroad configs open a popup)
  const popupPromise = page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null);
  await googleBtn.click();

  // Wait briefly to see what happened
  await page.waitForTimeout(3000);
  const urlAfterClick = page.url();

  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('  Sign in with: leegier6@gmail.com');
  console.log('  Then click Allow on the Gumroad permissions screen.');
  console.log('  Waiting up to 10 minutes...');
  console.log('════════════════════════════════════════════════════════');
  console.log('');

  if (urlAfterClick.includes('accounts.google.com') || urlAfterClick.includes('google.com/o/oauth2')) {
    // Main page navigated directly to Google — wait for it to return to gumroad.com
    console.log('  Main page at Google sign-in. Waiting for OAuth to complete...');
    try {
      await page.waitForURL('https://gumroad.com/**', { timeout: 600000 });
    } catch (e) {
      throw new Error(`OAuth timed out — main page URL: ${page.url()}`);
    }
    await page.waitForTimeout(3000);
    console.log('  Returned to Gumroad:', page.url());
    // Navigate to app subdomain to verify session
    await page.goto('https://app.gumroad.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  } else {
    // Check if a popup opened
    const popup = await popupPromise;
    if (!popup) {
      await page.screenshot({ path: `Z:/openclaw/workspace/gumroad-noaction-${Date.now()}.png` });
      throw new Error(`Google button clicked but no navigation or popup. URL: ${urlAfterClick}`);
    }
    await popup.bringToFront();
    console.log('  Popup opened. Waiting for OAuth to complete...');
    try {
      await popup.waitForURL('https://gumroad.com/**', { timeout: 600000 });
    } catch (e) {
      throw new Error(`OAuth timed out — popup URL: ${popup.url()}`);
    }
    await popup.waitForTimeout(3000);
    console.log('  Popup returned to Gumroad:', popup.url());
    // Cookies are now set in shared context — verify main page can access app
    await page.bringToFront();
    await page.goto('https://app.gumroad.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  const finalUrl = page.url();
  console.log('  App URL:', finalUrl);

  if (finalUrl.includes('login') || finalUrl.includes('accounts.google')) {
    throw new Error(`Login failed — app.gumroad.com redirected to: ${finalUrl}`);
  }

  console.log('✓ Logged in to Gumroad:', finalUrl);
}

async function createProduct(page, product) {
  console.log(`\n→ Creating: ${product.name}`);

  // Navigate to new product page
  await page.goto('https://app.gumroad.com/products/new', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Check if we got redirected to login
  if (page.url().includes('login') || page.url().includes('accounts.google.com')) {
    throw new Error('Session expired during product creation — need to re-login');
  }

  console.log('  On page:', page.url());

  // Gumroad might show a product type selector first
  // Try clicking "Digital product" if it exists
  const typeSelectors = [
    'text=Digital product',
    'button:has-text("Digital")',
    '[data-type="digital"]',
    'label:has-text("Digital")',
  ];

  for (const sel of typeSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('  Selecting digital product type...');
      await el.click();
      await page.waitForTimeout(1500);
      break;
    }
  }

  // Take a screenshot to see current state
  await page.screenshot({ path: `Z:/openclaw/workspace/gumroad-step-${Date.now()}.png` });

  // Wait for and fill product name
  // Gumroad 2025+ uses contenteditable or specific named inputs
  const nameSelectors = [
    'input[name="name"]',
    'input[placeholder*="name" i]',
    'input[placeholder*="product" i]',
    'input[placeholder*="title" i]',
    'textarea[name="name"]',
    '[contenteditable][placeholder*="name" i]',
    'input[type="text"]:not([type="search"]):not([type="email"])',
  ];

  let nameFilled = false;
  for (const sel of nameSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`  Filling name with selector: ${sel}`);
      await el.fill(product.name);
      nameFilled = true;
      break;
    }
  }

  if (!nameFilled) {
    // Screenshot and throw — we need to see what's on screen
    await page.screenshot({ path: `Z:/openclaw/workspace/gumroad-noname-${Date.now()}.png` });
    throw new Error('Could not find product name input. Check screenshot for current page state.');
  }

  // Click Next/Continue if present
  const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Create")').first();
  if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  Clicking Next...');
    await nextBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  }

  // Set price
  const priceSelectors = [
    'input[name="price"]',
    'input[placeholder*="price" i]',
    'input[placeholder*="$" i]',
    'input[type="number"]',
  ];

  for (const sel of priceSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  Setting price...');
      await el.triple_click ? await el.click({ clickCount: 3 }) : await el.click();
      await el.fill(product.price);
      break;
    }
  }

  // Set description
  const descSelectors = [
    'textarea[name="description"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
    '.ql-editor',
    '[data-placeholder*="description" i]',
  ];

  for (const sel of descSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  Setting description...');
      await el.click();
      await el.fill(product.description);
      break;
    }
  }

  // Upload file
  console.log('  Uploading ZIP...');
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await fileInput.setInputFiles(product.zipPath);
    await page.waitForTimeout(6000); // wait for upload
  } else {
    // File input might be hidden but still usable
    await page.locator('input[type="file"]').first().setInputFiles(product.zipPath);
    await page.waitForTimeout(6000);
  }

  // Save / Publish
  const saveSelectors = [
    'button:has-text("Save")',
    'button:has-text("Publish")',
    'button:has-text("Update")',
    'button[type="submit"]',
  ];

  for (const sel of saveSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  Saving product...');
      await el.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      break;
    }
  }

  const url = page.url();
  console.log('  ✓ Done. URL:', url);
  return url;
}

async function run() {
  const hasSavedSession = fs.existsSync(AUTH_STATE);
  console.log(`Session state: ${hasSavedSession ? 'found' : 'not found — will do visible login'}`);

  const browser = await chromium.launch({
    headless: hasSavedSession,
    slowMo: hasSavedSession ? 100 : 200,
    args: ['--no-sandbox'],
  });

  const context = hasSavedSession
    ? await browser.newContext({ storageState: AUTH_STATE })
    : await browser.newContext();

  const page = await context.newPage();

  if (!hasSavedSession) {
    // Visible login flow
    await login(page);

    // Verify we're actually logged in before saving
    const verifyUrl = page.url();
    if (verifyUrl.includes('login') || verifyUrl.includes('accounts.google.com')) {
      await browser.close();
      throw new Error(`Login verification failed — URL: ${verifyUrl}`);
    }

    // Save valid session
    await context.storageState({ path: AUTH_STATE });
    console.log('✓ Session saved to', AUTH_STATE);
  } else {
    console.log('✓ Session loaded. Verifying...');
    await page.goto('https://app.gumroad.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const verifyUrl = page.url();
    console.log('  Verify URL:', verifyUrl);

    if (verifyUrl.includes('login') || !verifyUrl.includes('gumroad.com') || verifyUrl.includes('accounts.google')) {
      console.log('  Session expired — deleting and re-running with visible browser...');
      await browser.close();
      fs.unlinkSync(AUTH_STATE);
      return run();
    }
    console.log('  Session valid.');
  }

  const results = [];

  for (const product of PRODUCTS) {
    try {
      const url = await createProduct(page, product);
      results.push({ name: product.name, url, status: 'LIVE' });
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      const shotPath = `Z:/openclaw/workspace/gumroad-error-${Date.now()}.png`;
      await page.screenshot({ path: shotPath }).catch(() => {});
      console.error(`  Screenshot: ${shotPath}`);
      results.push({ name: product.name, status: 'FAILED', error: err.message });
    }
  }

  console.log('\n=== Results ===');
  for (const r of results) {
    console.log(`${r.status === 'LIVE' ? '✓' : '✗'} ${r.name}`);
    if (r.url) console.log(`  URL: ${r.url}`);
    if (r.error) console.log(`  Error: ${r.error}`);
  }

  fs.writeFileSync('Z:/openclaw/workspace/gumroad-results.json', JSON.stringify(results, null, 2));
  console.log('\nDone. Results → gumroad-results.json');

  if (!hasSavedSession) {
    await page.waitForTimeout(8000);
  }
  await browser.close();
}

run().catch(async (err) => {
  console.error('FATAL:', err.message);
  fs.writeFileSync('Z:/openclaw/workspace/gumroad-results.json', JSON.stringify([{
    status: 'FATAL', error: err.message,
  }], null, 2));
  process.exit(1);
});
