const { chromium } = require('@playwright/test');

(async () => {
  // Use existing Edge profile that's already logged into itch.io
  const browser = await chromium.launchPersistentContext(
    'C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data/Default',
    {
      channel: 'msedge',
      headless: true,
    }
  );
  
  const page = await browser.newPage();
  
  // Check game IDs we know about
  const gameIds = ['4379091', '4379094', '4420990', '4420991', '4420992'];
  
  for (const id of gameIds) {
    try {
      await page.goto(`https://itch.io/game/edit/${id}`, { waitUntil: 'networkidle', timeout: 10000 });
      const title = await page.title();
      const priceEl = await page.$('input[name="game[price]"], #game_price');
      const price = priceEl ? await priceEl.inputValue() : 'no price field';
      console.log(`ID ${id}: ${title} | price: ${price}`);
    } catch(e) {
      console.log(`ID ${id}: error - ${e.message}`);
    }
  }
  
  await browser.close();
})();
