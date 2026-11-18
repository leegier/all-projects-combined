/**
 * itchio-playwright.js — Create CLAWED game page on itch.io via browser automation
 * Run: node itchio-playwright.js
 */

import { chromium } from 'playwright';
import fs from 'fs';

import { readFileSync } from 'fs';
const CREDS = JSON.parse(readFileSync('Z:/openclaw/workspace/credentials.json', 'utf8'));
const EMAIL = CREDS.platforms.itchio.email;
const PASSWORD = CREDS.platforms.itchio.password;

const CLAWED = {
  title: 'CLAWED — Tactical Prison Stealth Game',
  shortDesc: 'Escape. Survive. Claw your way out. Tactical stealth-survival in a brutal prison. Guard AI that reacts to sound and sight.',
  description: `CLAWED is a first-person stealth survival game set in a brutal prison. You're trapped. The guards are smart. The environment is your only weapon.

FEATURES IN DEMO v0.1:
• Reactive guard AI — patrol → suspicious → chase → attack states
• Full inventory system with item interaction
• Stamina, hunger, and health survival mechanics
• Stealth system with noise and visibility detection
• Handcrafted prison level

CONTROLS:
WASD + Mouse | E to interact | Shift to sprint (costs stamina) | Tab for inventory

PLANNED FEATURES (v1.0):
• Procedurally generated cell blocks
• Multiplayer 2-4 player co-op
• Crafting system expansion

Built in Unity 6. Windows build coming soon.`,
  price: '2.99',
  tags: 'stealth, survival, prison, first-person, unity, guard-ai, early-access',
  kind: 'game',
};

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Logging into itch.io...');
  await page.goto('https://itch.io/login');
  await page.fill('input[name="username"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  const url = page.url();
  if (url.includes('login')) {
    // Try with username instead of email
    await page.fill('input[name="username"]', 'THE-FORGE-IDE-GAMEDEV');
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  console.log('✓ Logged in, navigating to new game page...');

  await page.goto('https://itch.io/game/new');
  await page.waitForLoadState('networkidle');

  // Title
  const titleInput = page.locator('input[name="title"], input[placeholder*="title"]').first();
  await titleInput.fill(CLAWED.title);

  // Short description
  const shortDescInput = page.locator('input[name="short_description"], textarea[name="short_description"]').first();
  if (await shortDescInput.isVisible()) {
    await shortDescInput.fill(CLAWED.shortDesc);
  }

  // Kind — game
  const kindSelect = page.locator('select[name="type"], select[name="classification"]').first();
  if (await kindSelect.isVisible()) {
    await kindSelect.selectOption('game');
  }

  // Save to get to the full edit page
  const saveBtn = page.locator('button[type="submit"], input[type="submit"]').first();
  await saveBtn.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('Game page created, filling details...');
  console.log('Current URL:', page.url());

  // Description (rich text or textarea)
  const descArea = page.locator('textarea[name="description"]').first();
  if (await descArea.isVisible()) {
    await descArea.fill(CLAWED.description);
  }

  // Pricing
  const paidRadio = page.locator('input[value="paid"], label:has-text("Paid")').first();
  if (await paidRadio.isVisible()) await paidRadio.click();

  const priceInput = page.locator('input[name="minimum_price"], input[name="price"]').first();
  if (await priceInput.isVisible()) await priceInput.fill(CLAWED.price);

  // Platform — Windows
  const winCheckbox = page.locator('input[name="p_windows"], label:has-text("Windows")').first();
  if (await winCheckbox.isVisible()) await winCheckbox.check();

  // Tags
  const tagInput = page.locator('input[name="tags"], input[placeholder*="tag"]').first();
  if (await tagInput.isVisible()) await tagInput.fill(CLAWED.tags);

  // Save
  const saveBtn2 = page.locator('button:has-text("Save"), input[value="Save"]').first();
  await saveBtn2.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const finalUrl = page.url();
  console.log('✓ CLAWED page saved:', finalUrl);

  // Save result
  const result = { title: CLAWED.title, url: finalUrl, status: 'CREATED' };
  fs.writeFileSync('Z:/openclaw/workspace/itchio-results.json', JSON.stringify(result, null, 2));

  console.log('\n=== itch.io Result ===');
  console.log('✓ CLAWED page live at:', finalUrl);
  console.log('Next: Fix Unity compile errors → build → upload via butler');

  await page.waitForTimeout(8000);
  await browser.close();
}

run().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
