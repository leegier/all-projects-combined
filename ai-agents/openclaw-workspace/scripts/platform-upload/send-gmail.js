/**
 * send-gmail.js — Send email via Playwright browser automation
 * Logs into Gmail web and sends from maxgier2026@gmail.com
 */
const { chromium } = require('playwright');

const FROM_EMAIL = 'maxgier2026@gmail.com';
const FROM_PASS  = 'Gameover2026!!';
const TO_EMAIL   = 'arigier2026@gmail.com';
const SUBJECT    = '👻 Haunted America is LIVE — Check it out Ari!';
const BODY       = `Hey Ari! 👋

Haunted America just went live. Every haunted location in the US, real evidence, live investigations, ghost hunting tools — all in one app. Lee built this for you two.

Open it here: https://leegier.github.io/haunted-america/

What's inside:
🗺️ Every haunted location in America with real documented evidence
🔮 EMF detector, EVP recorder, Spirit Box, Thermal scanner, K2 meter
🔴 Watch live investigations happening right now
💬 Community of 891,000 ghost hunters
📍 Interactive paranormal activity map across all 50 states

Enjoy! 👻

— MAX · AI Agent · OZARK01`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    console.log('Opening Gmail...');
    await page.goto('https://mail.google.com/', { waitUntil: 'networkidle', timeout: 30000 });

    // Check if already logged in
    const url = page.url();
    if (url.includes('accounts.google.com')) {
      console.log('Logging in...');
      await page.fill('input[type="email"]', FROM_EMAIL);
      await page.click('#identifierNext');
      await page.waitForTimeout(2000);
      await page.fill('input[type="password"]', FROM_PASS);
      await page.click('#passwordNext');
      await page.waitForTimeout(4000);
    }

    console.log('Opening compose...');
    await page.waitForSelector('[gh="cm"]', { timeout: 15000 });
    await page.click('[gh="cm"]');
    await page.waitForTimeout(1500);

    // Fill To
    await page.fill('[name="to"]', TO_EMAIL);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Fill Subject
    await page.fill('[name="subjectbox"]', SUBJECT);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Fill body
    const bodyEl = await page.$('[role="textbox"][aria-label*="Body"]') ||
                   await page.$('.Am.Al.editable');
    if (bodyEl) {
      await bodyEl.click();
      await page.keyboard.type(BODY);
    }

    await page.waitForTimeout(1000);

    // Send
    await page.click('[data-tooltip="Send"]');
    await page.waitForTimeout(3000);

    console.log('✅ Email sent to', TO_EMAIL);
  } catch(e) {
    console.error('ERROR:', e.message);
    await page.screenshot({ path: 'Z:/openclaw/workspace/gmail-error.png' });
    console.log('Screenshot saved to gmail-error.png');
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
