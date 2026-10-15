// Shared Playwright helpers for tests / capture.
import { chromium } from 'playwright-core';
import { serve } from './serve.mjs';
export const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
// NH_GL=llvmpipe (run under xvfb-run) uses Mesa llvmpipe through ANGLE's GL backend: ~6x faster than SwiftShader here.
export const LLVMPIPE = process.env.NH_GL === 'llvmpipe';
export const ARGS = LLVMPIPE
  ? ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'];
export async function open({ port = 8090, query = 'auto&manual', width = 1280, height = 720, log = true, path = '/' } = {}) {
  const srv = await serve(port);
  const browser = await chromium.launch({ executablePath: CHROME, args: ARGS, headless: !LLVMPIPE });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning') { errors.push(t); if (log) console.log('[page]', m.type(), t.slice(0, 400)); } else if (log && t.startsWith('[NH]')) console.log(t); });
  page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')); });
  await page.goto(`http://localhost:${port}${path}?${query}`);
  await page.waitForFunction('window.NH_READY || window.NH_ERROR', null, { timeout: 180000 });
  const err = await page.evaluate('window.NH_ERROR'); if (err) { console.log(err); throw new Error('boot failed'); }
  return { page, browser, srv, errors, close: async () => { await browser.close(); srv.close(); } };
}
