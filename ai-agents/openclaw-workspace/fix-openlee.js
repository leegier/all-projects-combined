const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launchPersistentContext('C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data', {
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: false,
    args: ['--profile-directory=Default']
  });
  const page = await browser.newPage();
  
  // Get all games from dashboard
  await page.goto('https://itch.io/dashboard/games', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'));
    return anchors
      .filter(a => a.href && a.href.includes('/dashboard/game/'))
      .map(a => ({ href: a.href, text: a.textContent.trim() }))
      .filter(l => l.text.length > 0);
  });
  console.log('Games found:', JSON.stringify(links.slice(0, 30)));
  
  // Find OPEN-LEE
  const openlee = links.find(l => l.text.toLowerCase().includes('open') || l.href.includes('4420'));
  console.log('OPEN-LEE candidate:', JSON.stringify(openlee));
  
  await browser.close();
})();
