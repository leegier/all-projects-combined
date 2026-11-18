#!/usr/bin/env node
// MAX Telegram Command & Control Bot
// Sends alerts, receives commands, reports status

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

// ------- CONFIG -------
const TOKEN = '8511307797:AAFivjQdGTxe8CkOualrFOxd381KsD7jGDU';
const WORKSPACE = 'E:/openclaw/workspace';
const HEARTBEAT_INTERVAL = 60 * 60 * 1000; // 1 hour
const WATCHDOG_INTERVAL = 5 * 60 * 1000;   // 5 min

// Owner chat ID — set on first /start
const STATE_FILE = path.join(WORKSPACE, 'scripts/telegram-state.json');

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { ownerChatId: null, alerts: true, hourlyReports: true }; }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

let state = loadState();
const bot = new TelegramBot(TOKEN, { polling: true });

// ------- HELPERS -------
function readFile(name) {
  try { return fs.readFileSync(path.join(WORKSPACE, name), 'utf8'); }
  catch { return null; }
}

function isOwner(chatId) {
  return state.ownerChatId && chatId === state.ownerChatId;
}

function sendOwner(text) {
  if (state.ownerChatId) {
    bot.sendMessage(state.ownerChatId, text, { parse_mode: 'Markdown' }).catch(() => {});
  }
}

function getGatewayStatus() {
  try {
    execSync('curl -s --max-time 3 http://127.0.0.1:18789/', { encoding: 'utf8' });
    return '🟢 UP';
  } catch { return '🔴 DOWN'; }
}

function getMissionControlStatus() {
  try {
    execSync('curl -s --max-time 3 http://localhost:3333/', { encoding: 'utf8' });
    return '🟢 UP';
  } catch { return '🔴 DOWN'; }
}

function getNodeProcesses() {
  try {
    const out = execSync('tasklist /fi "imagename eq node.exe" /fo csv /nh', { encoding: 'utf8' });
    const lines = out.trim().split('\n').filter(l => l.includes('node.exe'));
    return lines.length;
  } catch { return 0; }
}

function getBlockersSummary() {
  const raw = readFile('BLOCKERS.md');
  if (!raw) return 'No BLOCKERS.md found.';
  // Extract lines starting with ##
  const sections = raw.split('\n').filter(l => l.startsWith('## ')).map(l => l.replace('## ', ''));
  if (sections.length === 0) return 'No active blockers.';
  return sections.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

function getRevenueSummary() {
  // Check for money file
  const now = new Date();
  const monthFile = `memory/money-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.md`;
  const raw = readFile(monthFile);
  if (!raw) return 'No revenue log found for this month.';
  // Return last 500 chars
  return raw.slice(-500);
}

function getBriefSummary() {
  const raw = readFile('BRIEF.md');
  if (!raw) return 'No BRIEF.md found.';
  // First 800 chars
  return raw.substring(0, 800) + (raw.length > 800 ? '\n...(truncated)' : '');
}

// ------- COMMANDS -------

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!state.ownerChatId) {
    state.ownerChatId = chatId;
    saveState(state);
    bot.sendMessage(chatId, `🔒 *Owner registered.* Chat ID: \`${chatId}\`\n\nYou'll now receive all MAX alerts here.\n\nCommands:\n/status — System status\n/blockers — Current blockers\n/revenue — Revenue summary\n/brief — Today's brief\n/kill — Kill all node.exe\n/restart — Restart MAX gateway\n/mute — Mute alerts\n/unmute — Unmute alerts\n/ping — Am I alive?`, { parse_mode: 'Markdown' });
  } else if (isOwner(chatId)) {
    bot.sendMessage(chatId, '✅ You\'re already registered as owner.');
  } else {
    bot.sendMessage(chatId, '⛔ This bot is private.');
  }
});

bot.onText(/\/ping/, (msg) => {
  if (!isOwner(msg.chat.id)) return;
  bot.sendMessage(msg.chat.id, '🏓 Pong. Bot is alive.');
});

bot.onText(/\/status/, (msg) => {
  if (!isOwner(msg.chat.id)) return;
  const gateway = getGatewayStatus();
  const mc = getMissionControlStatus();
  const nodeCount = getNodeProcesses();
  const uptime = process.uptime();
  const hrs = Math.floor(uptime / 3600);
  const mins = Math.floor((uptime % 3600) / 60);

  bot.sendMessage(msg.chat.id,
    `📊 *MAX Status Report*\n\n` +
    `Gateway: ${gateway}\n` +
    `Mission Control: ${mc}\n` +
    `Node processes: ${nodeCount}\n` +
    `Bot uptime: ${hrs}h ${mins}m\n` +
    `Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/blockers/, (msg) => {
  if (!isOwner(msg.chat.id)) return;
  bot.sendMessage(msg.chat.id, `🚧 *Active Blockers*\n\n${getBlockersSummary()}`, { parse_mode: 'Markdown' });
});

bot.onText(/\/revenue/, (msg) => {
  if (!isOwner(msg.chat.id)) return;
  bot.sendMessage(msg.chat.id, `💰 *Revenue Summary*\n\n${getRevenueSummary()}`, { parse_mode: 'Markdown' });
});

bot.onText(/\/brief/, (msg) => {
  if (!isOwner(msg.chat.id)) return;
  bot.sendMessage(msg.chat.id, `📋 *Brief*\n\n${getBriefSummary()}`, { parse_mode: 'Markdown' });
});

bot.onText(/\/kill/, (msg) => {
  if (!isOwner(msg.chat.id)) return;
  try {
    execSync('taskkill /f /im node.exe /fi "PID ne ' + process.pid + '"', { encoding: 'utf8' });
    bot.sendMessage(msg.chat.id, '💀 Killed all node.exe processes (except this bot).');
  } catch (e) {
    bot.sendMessage(msg.chat.id, '⚠️ Kill failed or no processes to kill.');
  }
});

bot.onText(/\/restart/, (msg) => {
  if (!isOwner(msg.chat.id)) return;
  bot.sendMessage(msg.chat.id, '🔄 Restarting MAX gateway...');
  exec('cd E:/openclaw/workspace && node gateway.js', (err) => {
    if (err) sendOwner('⚠️ Gateway restart failed: ' + err.message);
    else sendOwner('✅ Gateway restarted.');
  });
});

bot.onText(/\/mute/, (msg) => {
  if (!isOwner(msg.chat.id)) return;
  state.alerts = false;
  saveState(state);
  bot.sendMessage(msg.chat.id, '🔇 Alerts muted.');
});

bot.onText(/\/unmute/, (msg) => {
  if (!isOwner(msg.chat.id)) return;
  state.alerts = true;
  saveState(state);
  bot.sendMessage(msg.chat.id, '🔊 Alerts unmuted.');
});

// ------- WATCHDOG: check gateway every 5 min -------
let lastGatewayState = null;

function watchdog() {
  if (!state.alerts) return;
  const current = getGatewayStatus();
  if (lastGatewayState === '🟢 UP' && current === '🔴 DOWN') {
    sendOwner('🚨 *ALERT: MAX Gateway just went DOWN!*\n\nUse /restart to bring it back.');
  }
  if (lastGatewayState === '🔴 DOWN' && current === '🟢 UP') {
    sendOwner('✅ MAX Gateway is back UP.');
  }
  lastGatewayState = current;
}

setInterval(watchdog, WATCHDOG_INTERVAL);
watchdog(); // Initial check

// ------- HOURLY STATUS REPORT -------
function hourlyReport() {
  if (!state.hourlyReports || !state.alerts) return;
  const gateway = getGatewayStatus();
  const mc = getMissionControlStatus();
  const nodeCount = getNodeProcesses();
  const time = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

  sendOwner(
    `⏰ *Hourly Check-in*\n\n` +
    `Gateway: ${gateway}\n` +
    `Mission Control: ${mc}\n` +
    `Node procs: ${nodeCount}\n` +
    `Time: ${time}`
  );
}

setInterval(hourlyReport, HEARTBEAT_INTERVAL);

// ------- EXPORT for other scripts to send alerts -------
// Other MAX scripts can require this and call sendAlert()
function sendAlert(text) {
  sendOwner('🔔 ' + text);
}

module.exports = { sendAlert, sendOwner };

// ------- STARTUP -------
console.log('[telegram-bot] MAX Command & Control bot started.');
console.log('[telegram-bot] Waiting for owner to /start...');
if (state.ownerChatId) {
  console.log('[telegram-bot] Owner already registered: ' + state.ownerChatId);
  sendOwner('🟢 *MAX Bot restarted.* All systems monitoring active.');
}

