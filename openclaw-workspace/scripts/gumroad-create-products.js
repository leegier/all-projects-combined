/**
 * Gumroad Product Creator — Fixed login flow
 */

const { chromium } = require('playwright');

const CREDENTIALS = {
  email: 'leegier6@gmail.com',
  password: 'Gameover2026!!'
};

const PRODUCTS = [
  {
    name: 'AI Prompt Vault Pro — 500+ Battle-Tested ChatGPT & Claude Prompts',
    price: '19',
    description: `Stop wasting hours writing mediocre prompts. This vault contains 500+ expert-crafted prompts for coding, marketing, content, business strategy, and more — all tested and optimized for ChatGPT and Claude. Copy. Paste. Get results.

💻 80+ Coding prompts — debug errors, write clean functions, generate unit tests, refactor legacy code
📈 100+ Marketing prompts — ad copy, email sequences, content calendars, viral hooks
💼 80+ Business prompts — business plans, SOPs, pitch decks, market analysis
✍️ 100+ Content prompts — blog posts, YouTube scripts, social media, newsletters
🤝 80+ Sales prompts — cold emails, sales pages, objection handlers, proposals
🧠 60+ Productivity prompts — summaries, decision frameworks, reports

What You Get:
- 500+ prompts organized by use case for fast lookup
- Works with ChatGPT 4o, Claude, and any LLM
- Lifetime access plus free updates
- 30-day money-back guarantee`,
    file: 'Z:\\openclaw\\workspace\\products\\ai-prompt-vault\\prompts.md'
  },
  {
    name: 'Cold Email Arsenal — 50 Proven Templates That Get Replies',
    price: '27',
    description: `50 cold email templates that have generated real clients, deals, and opportunities. Not generic garbage — these are surgical, tested, and ready to copy-paste.

10 Cold Opener Templates — break through to ice-cold prospects
10 Follow-Up Sequences — 5-touch sequences including the breakup email
10 Partnership and Collaboration emails
10 Agency and Freelance Outreach templates
10 Link Building and PR Outreach emails

BONUS: 50 subject lines, personalization formulas, spam filter survival guide

- Copy-paste ready in under 5 minutes
- Works for any B2B service or product
- 30-day money-back guarantee`,
    file: 'Z:\\openclaw\\workspace\\products\\cold-email-arsenal\\templates.md'
  }
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login
    console.log('Going to Gumroad login...');
    await page.goto('https://gumroad.com/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Fill email and password fields directly
    console.log('Filling credentials...');
    await page.locator('input[type="email"]').fill(CREDENTIALS.email);
    await page.locator('input[type="password"]').fill(CREDENTIALS.password);
    
    // Click the Login button (not Google)
    await page.locator('button:has-text("Login"), input[value="Login"], button[type="submit"]:not(:has-text("Google"))').first().click();
    
    await page.waitForTimeout(4000);
    const afterLoginUrl = page.url();
    console.log('After login URL:', afterLoginUrl);
    await page.screenshot({ path: 'Z:\\openclaw\\workspace\\scripts\\debug-after-login.png' });

    if (afterLoginUrl.includes('/login')) {
      console.log('Still on login page — trying different selector...');
      await page.screenshot({ path: 'Z:\\openclaw\\workspace\\scripts\\debug-login-fail.png' });
      
      // Try direct form submit
      await page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.submit();
      });
      await page.waitForTimeout(4000);
      console.log('URL after form submit:', page.url());
    }

    // Check if logged in
    const isLoggedIn = !page.url().includes('/login');
    console.log('Logged in:', isLoggedIn);

    if (!isLoggedIn) {
      // Try navigating to dashboard directly
      await page.goto('https://app.gumroad.com/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      console.log('Dashboard URL:', page.url());
      await page.screenshot({ path: 'Z:\\openclaw\\workspace\\scripts\\debug-dashboard.png' });
    }

    // Now try product creation
    for (const product of PRODUCTS) {
      console.log(`\nCreating: ${product.name}`);
      
      // Try multiple product creation URLs
      const urls = [
        'https://app.gumroad.com/products/new',
        'https://gumroad.com/products/new',
        'https://app.gumroad.com/l/new'
      ];
      
      for (const url of urls) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);
        const current = page.url();
        console.log(`  Tried ${url} -> ${current}`);
        await page.screenshot({ path: `Z:\\openclaw\\workspace\\scripts\\debug-product-page.png` });
        
        if (!current.includes('/login')) {
          // We're on the right page, try to fill
          const nameInput = await page.$('input[name="name"], input[id*="name"], input[placeholder*="name" i], input[placeholder*="product" i]');
          if (nameInput) {
            console.log('  Found name input, filling...');
            await nameInput.fill(product.name);
            await page.screenshot({ path: `Z:\\openclaw\\workspace\\scripts\\debug-product-filled.png` });
            console.log('  Name filled successfully');
            break;
          } else {
            // Print all inputs on the page for debugging
            const inputs = await page.$$eval('input', els => els.map(e => ({type: e.type, name: e.name, id: e.id, placeholder: e.placeholder})));
            console.log('  Inputs found:', JSON.stringify(inputs));
          }
        }
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: 'Z:\\openclaw\\workspace\\scripts\\debug-error.png' });
  } finally {
    await browser.close();
  }
}

run().then(() => console.log('\nScript complete')).catch(e => console.error('Fatal:', e.message));
