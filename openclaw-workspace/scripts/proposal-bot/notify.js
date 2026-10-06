// notify.js — Telegram notifications for proposal-bot activity
// Reports to the same Telegram channel MAX uses

import fetch from 'node-fetch';
import { CONFIG } from './config.js';

async function send(text) {
  const chatId = CONFIG.telegram.chatId;
  if (!chatId) {
    console.log(`[Telegram] No chat ID set. Message would be: ${text}`);
    return;
  }

  const url = `https://api.telegram.org/bot${CONFIG.telegram.botToken}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  }).catch(e => console.error(`[Telegram] send failed: ${e.message}`));
}

export async function notifyProposalSent(job, proposal) {
  const text = `✅ *Proposal sent*
Platform: ${job.platform.toUpperCase()}
Job: ${job.title}
${job.url}

_First 120 chars:_
${proposal.slice(0, 120)}...`;
  await send(text);
}

export async function notifyProposalFailed(job, error) {
  await send(`⚠️ Proposal FAILED — ${job.platform.toUpperCase()}
Job: ${job.title}
Error: ${error}`);
}

export async function notifyRunComplete(stats, newProposals) {
  await send(`📊 *Proposal Bot Run Complete*
Sent this run: ${newProposals}
Total all-time: ${stats.total}
This week: ${stats.thisWeek}
Pending follow-ups: ${stats.pendingFollowUp}
Upwork: ${stats.byPlatform.upwork} | Fiverr: ${stats.byPlatform.fiverr}`);
}

export async function notifyFollowUpSent(job) {
  await send(`📩 Follow-up sent: ${job.title} (${job.platform})`);
}

export async function notifySessionNeeded(platform) {
  await send(`🔑 *Action required:* ${platform} session expired or missing.
Run: \`node scripts/proposal-bot/index.js --mode=login-${platform}\`
Or log in manually and run the save-session command.`);
}
