/**
 * check-email.js — MAX inbox monitor for maxgier2026@gmail.com
 * Run: node Z:/openclaw/workspace/scripts/check-email.js
 * Uses Gmail API via OAuth2 (requires credentials in credentials.json)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CREDENTIALS_FILE = 'Z:/openclaw/workspace/credentials.json';
const INBOX_LOG = 'Z:/openclaw/workspace/INBOX.md';
const MAX_EMAIL = 'maxgier2026@gmail.com';

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function appendInbox(entry) {
  const line = `\n## ${new Date().toISOString()}\n${entry}\n---\n`;
  fs.appendFileSync(INBOX_LOG, line, 'utf8');
}

// Read credentials
let creds = {};
try {
  creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
} catch(e) {
  log('ERROR: Could not read credentials.json — ' + e.message);
  process.exit(1);
}

const gmailToken = creds.gmail_access_token || creds.google_access_token;
if (!gmailToken) {
  log('ERROR: No gmail_access_token found in credentials.json');
  log('To set up Gmail API access:');
  log('1. Go to console.cloud.google.com → Create project → Enable Gmail API');
  log('2. Create OAuth credentials → Download JSON');
  log('3. Run: node Z:/openclaw/workspace/scripts/gmail-auth.js');
  log('4. Paste the access token into credentials.json as "gmail_access_token"');
  process.exit(1);
}

// Fetch unread emails
function gmailRequest(path, callback) {
  const options = {
    hostname: 'gmail.googleapis.com',
    path: path,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + gmailToken }
  };
  const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try { callback(null, JSON.parse(data)); }
      catch(e) { callback(e); }
    });
  });
  req.on('error', callback);
  req.end();
}

log(`Checking inbox: ${MAX_EMAIL}`);

gmailRequest('/gmail/v1/users/me/messages?q=is:unread&maxResults=20', (err, data) => {
  if (err || data.error) {
    log('Gmail API error: ' + JSON.stringify(err || data.error));
    log('Token may be expired. Re-run gmail-auth.js to refresh.');
    return;
  }

  const messages = data.messages || [];
  log(`Found ${messages.length} unread messages`);

  if (messages.length === 0) {
    log('Inbox clear.');
    return;
  }

  let processed = 0;
  messages.forEach(msg => {
    gmailRequest(`/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, (err, detail) => {
      if (err || !detail.payload) return;
      const headers = detail.payload.headers || [];
      const subject = (headers.find(h => h.name === 'Subject') || {}).value || '(no subject)';
      const from = (headers.find(h => h.name === 'From') || {}).value || '(unknown)';
      const date = (headers.find(h => h.name === 'Date') || {}).value || '';

      log(`  FROM: ${from}`);
      log(`  SUBJ: ${subject}`);

      appendInbox(`**From:** ${from}\n**Subject:** ${subject}\n**Date:** ${date}\n**ID:** ${msg.id}`);

      processed++;
      if (processed === messages.length) {
        log('All messages logged to INBOX.md');
      }
    });
  });
});
