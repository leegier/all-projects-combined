#!/usr/bin/env node
// 2 AM Nightly Autonomous Worker
// Reviews empire state, picks 1 revenue task, executes it

const Anthropic = require('@anthropic-ai/sdk');
const https = require('https');
const fs = require('fs');

const client = new Anthropic({
  apiKey: process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api' : undefined,
});
const BOT_TOKEN = 'MTQ4NTM2NzIzMTQyNzkwMzU3OQ.GZ2jEt.ZWsJZnWRpj0gWiEUQsebXzihPEfLa6FZOGTBCw';

async function sendDiscord(channelId, message) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ content: message });
    const options = {
      hostname: 'discord.com',
      path: `/api/v10/channels/${channelId}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', resolve);
    req.write(body);
    req.end();
  });
}

async function main() {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  let briefContent = '';
  try {
    briefContent = fs.readFileSync('Z:\\openclaw\\workspace\\BRIEF.md', 'utf8');
  } catch (e) {
    briefContent = 'Empire is building. Products: CLAWED on itch.io, AI Prompt Vault on itch.io. Goals: generate revenue, build audience, ship products.';
  }

  const response = await client.messages.create({
    model: process.env.OPENROUTER_API_KEY ? 'anthropic/claude-sonnet-4' : 'claude-sonnet-4-6',
    max_tokens: 600,
    system: `You are MAX, an autonomous AI employee working for Lee at 2 AM. Your job is to review the empire state and identify the ONE highest-value task you can execute right now to move closer to the revenue goal. Be specific, be actionable, and be brief. Format:
**2 AM NIGHTLY AUDIT — ${date}**
**Task Selected:** [what you chose]
**Why:** [one sentence]
**What I did:** [2-3 bullet points of actual actions taken]
**Expected impact:** [specific outcome]`,
    messages: [{ role: 'user', content: `Empire state:\n${briefContent}\n\nWhat is the one task you will execute tonight to bring us closer to generating revenue?` }]
  });

  const report = response.content[0].text;
  console.log(report);

  const MISSION_CONTROL_CHANNEL = process.env.DISCORD_MISSION_CONTROL || '1484731361272139838';
  await sendDiscord(MISSION_CONTROL_CHANNEL, report);

  const logDir = 'Z:\\openclaw\\workspace\\logs';
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(`${logDir}\\nightly-${new Date().toISOString().split('T')[0]}.md`, `\n\n${report}`);
}

main().catch(console.error);
