/**
 * discord-perms.js — Enable Manage Channels on MAX role via browser automation
 * Uses existing Chrome user profile (already logged into Discord)
 */
import { chromium } from 'playwright';

const GUILD_ID = '1484731360382812204';

async function run() {
  // Launch with existing Chrome user data so Discord session is active
  const userDataDir = 'C:\\Users\\Gierl\\AppData\\Local\\Google\\Chrome\\User Data';
  
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    slowMo: 300,
    args: ['--no-sandbox', '--profile-directory=Default']
  });

  const page = await browser.newPage();
  
  console.log('Opening Discord...');
  await page.goto('https://discord.com/channels/@me', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/discord-start.png' });
  
  // Navigate to server settings
  console.log('Navigating to server...');
  await page.goto(`https://discord.com/channels/${GUILD_ID}/@home`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // Right-click server icon or find server settings
  // Look for the server name at the top of the channel list
  const serverName = page.locator('[class*="header"] [class*="name"], h2[class*="title"]').first();
  if (await serverName.isVisible({ timeout: 5000 }).catch(() => false)) {
    await serverName.click();
    await page.waitForTimeout(1000);
  }
  
  await page.screenshot({ path: 'Z:/openclaw/workspace/discord-server.png' });
  
  // Look for server settings dropdown
  const settingsLink = page.locator('a[href*="server-settings"], [aria-label*="Server Settings"], text="Server Settings"').first();
  if (await settingsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await settingsLink.click();
  } else {
    // Try direct URL
    await page.goto(`https://discord.com/channels/${GUILD_ID}/server-settings/roles`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'Z:/openclaw/workspace/discord-settings.png' });
  console.log('Settings page:', page.url());
  
  // Navigate to roles
  const rolesNav = page.locator('a:has-text("Roles"), [href*="roles"]').first();
  if (await rolesNav.isVisible({ timeout: 3000 }).catch(() => false)) {
    await rolesNav.click();
    await page.waitForTimeout(1500);
  }
  
  await page.screenshot({ path: 'Z:/openclaw/workspace/discord-roles.png' });
  
  // Find MAX role
  const maxRole = page.locator('[class*="role"] [class*="name"]:has-text("MAX"), div:has-text("MAX")').first();
  if (await maxRole.isVisible({ timeout: 5000 }).catch(() => false)) {
    await maxRole.click();
    await page.waitForTimeout(1500);
    console.log('Found MAX role, clicking...');
  } else {
    console.log('MAX role not found by text, taking screenshot');
    await page.screenshot({ path: 'Z:/openclaw/workspace/discord-roles-list.png' });
  }
  
  await page.screenshot({ path: 'Z:/openclaw/workspace/discord-max-role.png' });
  
  // Look for Manage Channels toggle
  const manageChannels = page.locator('text=Manage Channels, [aria-label*="Manage Channels"]').first();
  if (await manageChannels.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Found Manage Channels permission');
    // Find the toggle near it
    const toggle = manageChannels.locator('..').locator('[role="switch"], input[type="checkbox"]').first();
    const isOn = await toggle.getAttribute('aria-checked').catch(() => null);
    console.log('Current state:', isOn);
    if (isOn !== 'true') {
      await toggle.click();
      await page.waitForTimeout(1000);
      console.log('Toggled ON');
    } else {
      console.log('Already enabled');
    }
  }
  
  // Save
  const saveBtn = page.locator('button:has-text("Save Changes"), button[type="submit"]').first();
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    console.log('Saved!');
  }
  
  await page.screenshot({ path: 'Z:/openclaw/workspace/discord-done.png' });
  console.log('Done. Check Z:/openclaw/workspace/discord-done.png');
  
  await page.waitForTimeout(5000);
  await browser.close();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
