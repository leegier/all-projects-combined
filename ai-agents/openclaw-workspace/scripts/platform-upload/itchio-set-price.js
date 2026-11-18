/**
 * itchio-set-price.js — Set price on itch.io game via API (no browser needed)
 * Usage: node itchio-set-price.js --game-id=4420990 --price=19
 */
import https from 'https';
import fs from 'fs';

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.slice(2).split('=');
    return [k, v];
  })
);

const GAME_ID = args['game-id'] || '4420990';
const PRICE = parseFloat(args['price'] || '19');
const API_KEY = '8lzxDRwhgUvCp1WeiooJS6fkFmu4xWjjHv7O6BFb';
const BLOCKERS_FILE = 'Z:/openclaw/workspace/BLOCKERS.md';

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function blocker(msg) {
  fs.appendFileSync(BLOCKERS_FILE, `\n## itchio-set-price ${GAME_ID} — ${new Date().toISOString()}\n${msg}\n`);
}

function apiRequest(method, path, body, cb) {
  const data = body ? new URLSearchParams(body).toString() : null;
  const opts = {
    hostname: 'itch.io',
    path,
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
    }
  };
  const req = https.request(opts, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try { cb(null, JSON.parse(d), res.statusCode); }
      catch(e) { cb(null, d, res.statusCode); }
    });
  });
  req.on('error', cb);
  if (data) req.write(data);
  req.end();
}

log(`Setting game ${GAME_ID} price to $${PRICE} via itch.io API...`);

// Verify game exists first
apiRequest('GET', `/api/1/key/my-games`, null, (err, data) => {
  if (err) { log('ERROR: ' + err.message); blocker(err.message); process.exit(1); }

  const games = data.games || [];
  const game = games.find(g => String(g.id) === String(GAME_ID));

  if (!game) {
    const msg = `Game ID ${GAME_ID} not found. Available: ${games.map(g=>g.id+':'+g.title).join(', ')}`;
    log('ERROR: ' + msg);
    blocker(msg);
    process.exit(1);
  }

  log(`Found: "${game.title}" — current price: $${game.min_price/100}`);

  if (game.min_price === PRICE * 100) {
    log(`Already at $${PRICE}. Nothing to do.`);
    process.exit(0);
  }

  // Set price via game edit endpoint
  apiRequest('POST', `/api/1/key/games/${GAME_ID}/edit`, {
    'game[min_price]': Math.round(PRICE * 100)
  }, (err2, res2, status) => {
    if (err2) { log('ERROR: ' + err2.message); blocker(err2.message); process.exit(1); }

    if (status === 200 || (res2 && !res2.errors)) {
      log(`✅ SUCCESS: "${game.title}" price set to $${PRICE}`);
    } else {
      const msg = `API returned ${status}: ${JSON.stringify(res2)}`;
      log('NOTE: ' + msg);
      log('itch.io price API may require dashboard. Check manually.');
      blocker(`Price set attempt returned: ${msg}`);
    }
  });
});
