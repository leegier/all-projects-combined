#!/usr/bin/env node
// 1 PM Daily Brief — Full Empire Summary

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
      headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve()); });
    req.on('error', resolve);
    req.write(body);
    req.end();
  });
}

async function main() {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  let briefContent = '';
  try { briefContent = fs.readFileSync('Z:\\openclaw\\workspace\\BRIEF.md', 'utf8'); } catch (e) {}

  let nightlyLog = '';
  try {
    const today = new Date().toISOString().split('T')[0];
    nightlyLog = fs.readFileSync(`Z:\\openclaw\\workspace\\logs\\nightly-${today}.md`, 'utf8');
  } catch (e) {}

  const response = await client.messages.create({
    model: process.env.OPENROUTER_API_KEY ? 'anthropic/claude-sonnet-4' : 'claude-sonnet-4-6',
    max_tokens: 700,
    system: 'You are MAX delivering the 1 PM daily brief to Lee. Lee is a busy entrepreneur who wants facts fast — revenue, tasks done, what needs his attention, what is next. Sharp and direct.',
    messages: [{
      role: 'user',
      content: `Generate the 1 PM Daily Brief for ${date}.

Empire state: ${briefContent}
Nightly work: ${nightlyLog || 'No nightly log yet today'}

Format:
**🏰 DAILY BRIEF — ${date} @ ${time}**

**REVENUE TODAY**
What sold / what changed

**DONE SINCE LAST BRIEF**
Bullets of completed work

**NEEDS YOUR ATTENTION**
Max 3 items that require Lee to act

**TONIGHT'S PLAN**
What the 2 AM worker will tackle

Under 400 words.`
    }]
  });

  const brief = response.content[0].text;
  console.log(brief);

  const BRIEF_CHANNEL = process.env.DISCORD_DAILY_BRIEF || '1484731361272139838';
  await sendDiscord(BRIEF_CHANNEL, brief);
}

main().catch(console.error);
