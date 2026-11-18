/**
 * itchio-fix-price-chromium.js — Fix itch.io game prices using Playwright Chromium
 * Uses Chromium (NOT Edge) to avoid browser profile conflicts.
 * Usage: node itchio-fix-price-chromium.js
 */
import { chromium } from 'playwright';

const EMAIL = 'leegier6@gmail.com';
const PASSWORD = 'Gameover2026!!';

const GAMES_TO_FIX = [
  { id: '4420990', name: 'CLAWED', targetPrice: '10.00' },
];

async function run() {
  console.log('[START] Launching Chromium...');

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    // Login
    console.log('[LOGIN] Navigating to itch.io login...');
    await page.goto('https://itch.io/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    // Check if already logged in
    const loginForm = await page.$('form.login_form, input[name="username"]');
    if (loginForm) {
      console.log('[LOGIN] Filling credentials...');
      await page.fill('input[name="username"]', EMAIL);
      await page.fill('input[name="password"]', PASSWORD);
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForTimeout(5000);
      console.log('[LOGIN] Submitted. Current URL:', page.url());
    } else {
      console.log('[LOGIN] May already be logged in. URL:', page.url());
    }

    // Process each game
    for (const game of GAMES_TO_FIX) {
      console.log(`\n[GAME] Fixing ${game.name} (${game.id}) → $${game.targetPrice}`);

      const editUrl = `https://itch.io/game/edit/${game.id}`;
      console.log(`[NAV] Going to ${editUrl}`);
      await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);

      console.log('[PAGE] Current URL:', page.url());

      // Take screenshot for debugging
      await page.screenshot({ path: `Z:/openclaw/workspace/itchio-edit-${game.id}-chromium.png` });

      // Look for pricing section
      const priceInput = await page.$('input[name="game[min_price]"], input.price_input, #game_min_price');
      if (priceInput) {
        console.log('[PRICE] Found price input, setting to', game.targetPrice);
        await priceInput.fill('');
        await priceInput.fill(game.targetPrice);

        // Look for save button
        const saveBtn = await page.$('button.save_btn, button[type="submit"], input[type="submit"].save_btn');
        if (saveBtn) {
          console.log('[SAVE] Clicking save...');
          await saveBtn.click();
          await page.waitForTimeout(5000);
          console.log('[SAVE] Done. URL:', page.url());
          await page.screenshot({ path: `Z:/openclaw/workspace/itchio-saved-${game.id}-chromium.png` });
        } else {
          console.log('[WARN] No save button found. Taking screenshot...');
          await page.screenshot({ path: `Z:/openclaw/workspace/itchio-nosave-${game.id}-chromium.png`, fullPage: true });
        }
      } else {
        console.log('[WARN] No price input found. Page might need scroll or different selectors.');
        console.log('[DEBUG] Page title:', await page.title());
        await page.screenshot({ path: `Z:/openclaw/workspace/itchio-noprice-${game.id}-chromium.png`, fullPage: true });

        // Try to get page HTML for debugging
        const html = await page.content();
        const fs = await import('fs');
        fs.writeFileSync(`Z:/openclaw/workspace/itchio-html-${game.id}-chromium.txt`, html.substring(0, 5000));
      }
    }

    console.log('\n[DONE] All games processed.');

  } catch (err) {
    console.error('[FATAL]', err.message);
    await page.screenshot({ path: 'Z:/openclaw/workspace/itchio-error-chromium.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
}

run();
