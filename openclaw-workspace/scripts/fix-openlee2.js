const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Launching Edge with real profile...');
  
  // Use userDataDir pointing to the Default profile directory directly
  const userDataDir = 'C:/Users/Gierl/AppData/Local/Microsoft/Edge/User Data';
  
  const browser = await chromium.launchPersistentContext(
    userDataDir,
    {
      channel: 'msedge',
      headless: false,
      args: [
        '--profile-directory=Default',
        '--no-first-run',
        '--no-default-browser-check'
      ]
    }
  );
  
  const page = await browser.newPage();
  
  console.log('Going to itch.io dashboard...');
  await page.goto('https://itch.io/dashboard/games', { timeout: 20000 });
  await page.waitForTimeout(5000);
  
  const title = await page.title();
  const url = page.url();
  console.log('Title:', title);
  console.log('URL:', url);
  
  // Check if logged in
  const loggedIn = !url.includes('login') && title.includes('Dashboard');
  console.log('Logged in:', loggedIn);
  
  if (loggedIn) {
    // Get edit links
    const editLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/game/edit/"], a[href*="/dashboard/game/"]'))
        .map(a => ({ href: a.href, text: a.closest('.game_row, tr, li')?.querySelector('.title, .game_title')?.textContent?.trim() || a.textContent.trim() }));
    });
    console.log('Edit links:', JSON.stringify(editLinks));
    
    // Also get all links with "edit" 
    const allEditLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .filter(a => a.href.includes('edit'))
        .map(a => ({ href: a.href, text: a.textContent.trim().substring(0, 60) }));
    });
    console.log('All edit links:', JSON.stringify(allEditLinks.slice(0, 20)));
  }
  
  await browser.close();
})();
