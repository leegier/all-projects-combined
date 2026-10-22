#!/usr/bin/env node
// 8 AM Trend Scout — OpenClaw/Vibe Coding content pipeline

const Anthropic = require('@anthropic-ai/sdk');
const https = require('https');

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

  const response = await client.messages.create({
    model: process.env.OPENROUTER_API_KEY ? 'anthropic/claude-sonnet-4' : 'claude-sonnet-4-6',
    max_tokens: 700,
    system: 'You are SCOUT, a content intelligence agent. Identify trending topics in vibe coding, OpenClaw/agent frameworks, and AI game development that Lee can create content about. Think like a YouTube strategist.',
    messages: [{
      role: 'user',
      content: `Generate the 8 AM Trend Scout Report for ${date}.

**🔍 TREND SCOUT — ${date}**

**TOP 3 TRENDING TOPICS**
topic | why it's trending | content angle Lee can take

**COMPETITOR MOVE TO WATCH**
One thing a vibe coding / AI agent competitor did recently

**CONTENT PIPELINE — SCRIPTS TO APPROVE**
3 video script titles (short punchy YouTube titles) — react ✅ to approve, ❌ to skip

**HOOK OF THE DAY**
One viral-worthy opening line for a video or X post`
    }]
  });

  const report = response.content[0].text;
  console.log(report);

  const TREND_CHANNEL = process.env.DISCORD_TREND_SCOUT || '1484731361272139838';
  await sendDiscord(TREND_CHANNEL, report);
}

main().catch(console.error);
