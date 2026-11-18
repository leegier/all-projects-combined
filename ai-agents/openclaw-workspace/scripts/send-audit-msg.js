const https = require('https');
const fs = require('fs');
const path = require('path');

// Read token from existing daily-brief.js (BOT_TOKEN format)
const briefJs = fs.readFileSync(path.join(__dirname, 'daily-brief.js'), 'utf8');
const tokenMatch = briefJs.match(/BOT_TOKEN\s*=\s*'([^']+)'/);
if (!tokenMatch) { console.error('Could not find BOT_TOKEN'); process.exit(1); }
const BOT_TOKEN = tokenMatch[1];

const CHANNEL_ID = '1484731361272139838';
const MESSAGE = [
  '🔍 **REPO AUDIT: BRAXTON-CONFIG** (1 of 12)',
  '',
  '📁 `E:\\\\repos\\\\BRAXTON-CONFIG` — Electron desktop app: personal AI chat console called "CLAWBOT"',
  '',
  '**What it is:** Dark cyberpunk chat UI that talks to local Ollama (gemma3:27b). Has GPU node dashboard (simulated), Windows speech-to-text, and Electron Forge packaging for Windows installer.',
  '',
  '**Bugs fixed (3):**',
  '• `.gitignore` had stray markdown artifact — removed',
  '• STOP button broken (AbortController never wired) — fixed',
  '• Conversation history silently discarded each message — now sends full context',
  '',
  '**Money potential: 3/10** — Basic Ollama wrapper, not sellable as-is. Could bundle as CLAWED companion.',
  '**CLAWED game value: 6/10** — Already branded CLAWBOT, fits prison RPG lore. Needs real data feeds.',
  '',
  '📄 Full report saved to `E:\\\\openclaw\\\\workspace\\\\memory\\\\repo-audit-BRAXTON-CONFIG.md`'
].join('\n');

const body = JSON.stringify({ content: MESSAGE });
const options = {
  hostname: 'discord.com',
  path: `/api/v10/channels/${CHANNEL_ID}/messages`,
  method: 'POST',
  headers: {
    'Authorization': `Bot ${BOT_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(options, r => {
  let d = '';
  r.on('data', c => d += c);
  r.on('end', () => {
    console.log('Status:', r.statusCode);
    if (r.statusCode !== 200) console.log('Response:', d);
    else console.log('Message sent successfully');
  });
});
req.on('error', e => console.error('Error:', e.message));
req.write(body);
req.end();
