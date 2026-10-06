#!/usr/bin/env node
// Quick one-shot Telegram alert sender
// Usage: node telegram-alert.js "Your message here"
// Or:    require('./telegram-alert')('Your message here')

const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = '8511307797:AAFivjQdGTxe8CkOualrFOxd381KsD7jGDU';
const STATE_FILE = path.join(__dirname, 'telegram-state.json');

function sendAlert(text) {
  let chatId;
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    chatId = state.ownerChatId;
  } catch { return Promise.reject('No owner registered — /start the bot first'); }

  if (!chatId) return Promise.reject('No owner chat ID');

  const payload = JSON.stringify({
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// CLI mode
if (require.main === module) {
  const msg = process.argv.slice(2).join(' ') || 'Test alert from MAX';
  sendAlert(msg)
    .then(r => { console.log(r.ok ? 'Sent.' : 'Failed: ' + r.description); process.exit(r.ok ? 0 : 1); })
    .catch(e => { console.error(e); process.exit(1); });
}

module.exports = sendAlert;
