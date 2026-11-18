#!/usr/bin/env node
// 7 AM Stock Research Report
// AI buildout stocks — chips, energy, infrastructure

const Anthropic = require('@anthropic-ai/sdk');
const https = require('https');

const client = new Anthropic({
  apiKey: process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api' : undefined,
});
const BOT_TOKEN = 'MTQ4NTM2NzIzMTQyNzkwMzU3OQ.GZ2jEt.ZWsJZnWRpj0gWiEUQsebXzihPEfLa6FZOGTBCw';

async function sendDiscord(channelId, message) {
  return new Promise((resolve) => {
    const chunks = [];
    for (let i = 0; i < message.length; i += 1900) chunks.push(message.slice(i, i + 1900));

    const sendChunk = (chunk) => new Promise((res) => {
      const body = JSON.stringify({ content: chunk });
      const options = {
        hostname: 'discord.com',
        path: `/api/v10/channels/${channelId}/messages`,
        method: 'POST',
        headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      };
      const req = https.request(options, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res()); });
      req.on('error', res);
      req.write(body);
      req.end();
    });

    Promise.all(chunks.map(sendChunk)).then(resolve);
  });
}

async function main() {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const response = await client.messages.create({
    model: process.env.OPENROUTER_API_KEY ? 'anthropic/claude-sonnet-4' : 'claude-sonnet-4-6',
    max_tokens: 800,
    system: 'You are a sharp stock analyst focused on the AI infrastructure buildout thesis. Deliver a crisp daily brief on stocks that benefit from AI expansion: chips, energy, power infrastructure, data center hardware, networking. Focus on companies with strong moats. Be direct, no fluff.',
    messages: [{
      role: 'user',
      content: `Generate the daily AI Buildout Stock Brief for ${date}. Format:

**📈 AI BUILDOUT STOCK BRIEF — ${date}**

**TOP 5 MOAT STOCKS**
ticker | moat | why it matters today

**THESIS REMINDER**
2 sentences on the AI buildout investment case

**SUPPLY CHAIN SPOTLIGHT**
One specific area to watch this week

**RISK WATCH**
One key risk to the thesis right now`
    }]
  });

  const report = response.content[0].text;
  console.log(report);

  const STOCK_CHANNEL = process.env.DISCORD_STOCK_RESEARCH || '1484731361272139838';
  await sendDiscord(STOCK_CHANNEL, report);
}

main().catch(console.error);
