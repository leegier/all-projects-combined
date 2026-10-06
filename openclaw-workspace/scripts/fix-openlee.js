const { chromium } = require('playwright');

(async () => {
  console.log('Launching Edge with real profile...');
  const browser = await chromium.launchPersistentContext(
    'C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data',
    {
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      headless: false,
      args: ['--profile-directory=Default']
    }
  );
  
  const page = await browser.newPage();
  
  // Go to dashboard games to find all game IDs
  console.log('Loading dashboard games list...');
  await page.goto('https://itch.io/dashboard/games', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  const title = await page.title();
  console.log('Page title:', title);
  
  // Get all edit links
  const editLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links
      .filter(a => a.href.includes('/game/edit/') || a.href.includes('/dashboard/game/'))
      .map(a => ({ href: a.href, text: a.textContent.trim().substring(0, 50) }));
  });
  console.log('Edit links found:', JSON.stringify(editLinks));
  
  // Also get game titles on the page
  const gameTitles = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('.game_title, .title, h2, h3'));
    return cells.map(el => el.textContent.trim()).filter(t => t.length > 0).slice(0, 20);
  });
  console.log('Game titles on page:', JSON.stringify(gameTitles));
  
  await browser.close();
})();
