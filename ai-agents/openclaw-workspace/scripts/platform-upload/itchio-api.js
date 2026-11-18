/**
 * itchio-api.js — Create CLAWED game page on itch.io via API
 * No browser. No login. Just the API key.
 * Run: node itchio-api.js
 */

import https from 'https';
import fs from 'fs';

const API_KEY = '8lzxDRwhgUvCp1WeiooJS6fkFmu4xWjjHv7O6BFb';
const USERNAME = 'THE-FORGE-IDE-GAMEDEV';

function apiCall(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? new URLSearchParams(body).toString() : null;
    const opts = {
      hostname: 'itch.io',
      path: `/api/1/${API_KEY}${path}`,
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };
    if (postData) opts.headers['Content-Length'] = Buffer.byteLength(postData);

    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { resolve({ raw: d, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  // Check existing games first
  console.log('Checking existing itch.io games...');
  const gamesRes = await apiCall('GET', '/my-games');

  if (gamesRes.games) {
    console.log(`Found ${gamesRes.games.length} existing games:`);
    for (const g of gamesRes.games) {
      console.log(`  - ${g.title} | ${g.url} | published: ${g.published} | price: $${(g.min_price / 100).toFixed(2)}`);
    }
  }

  // Check if CLAWED already exists
  const existing = gamesRes.games?.find(g =>
    g.title.toLowerCase().includes('clawed') || g.url?.includes('clawed')
  );

  if (existing) {
    console.log('\n✓ CLAWED page already exists:', existing.url);
    fs.writeFileSync('Z:/openclaw/workspace/itchio-results.json', JSON.stringify({
      status: 'EXISTS',
      title: existing.title,
      url: existing.url,
      published: existing.published,
      price: existing.min_price / 100,
    }, null, 2));
    return;
  }

  // itch.io's API is read-only for game creation — need butler or web UI
  // But we can check what we need to do
  console.log('\nitch.io does not support game creation via REST API.');
  console.log('Game creation requires butler CLI or the web dashboard.');
  console.log('\nChecking if butler is installed...');

  // Check for butler
  const { execSync } = await import('child_process');
  try {
    const butlerVersion = execSync('butler version', { encoding: 'utf8' }).trim();
    console.log('butler found:', butlerVersion);
  } catch {
    console.log('butler not installed.');
    console.log('\nTo install butler:');
    console.log('  1. Download from: https://broth.itch.ovh/butler/windows-amd64/LATEST/archive/default');
    console.log('  2. Extract to C:/butler/butler.exe');
    console.log('  3. Add to PATH');
    console.log('\nAlternatively, create the CLAWED page manually at:');
    console.log('  https://itch.io/game/new');
    console.log('  Account: THE-FORGE-IDE-GAMEDEV (leegier6@gmail.com)');
  }

  // Write what we know
  const results = {
    status: 'API_READONLY',
    message: 'itch.io API is read-only. Game creation needs butler CLI or web UI.',
    existing_games: gamesRes.games?.map(g => ({ title: g.title, url: g.url, published: g.published })),
    action_needed: 'Install butler OR create page at https://itch.io/game/new',
  };

  fs.writeFileSync('Z:/openclaw/workspace/itchio-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to itchio-results.json');
}

run().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
