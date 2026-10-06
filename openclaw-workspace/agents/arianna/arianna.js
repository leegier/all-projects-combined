#!/usr/bin/env node
// ARIANNA — Coding Sub-Agent
// Powered by GPT-5.4 | All coding tasks route through here
// Usage: node arianna.js "your coding task"
// Or require and call: const { code } = require('./arianna')

const https = require('https');
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not set. Run sysdm.cpl → Environment Variables.');
  process.exit(1);
}

async function arianna(task, context = '') {
  const body = JSON.stringify({
    model: 'gpt-5.4',
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: `You are Arianna, an elite coding sub-agent working inside an AI empire. You work for Lee, a solo entrepreneur building AI-powered tools and games. Your job is to write clean, working, production-ready code — no placeholders, no TODOs, no hand-waving.

Stack you work with:
- Node.js / JavaScript (primary)
- Python (scripts, AI pipelines)
- Unity C# (game dev — CLAWED/Nyghtshade Hollow)
- Unreal Engine 5 (blueprints + C++)
- HTML/CSS/JS (web tools, landing pages)
- Discord bots, REST APIs, automation scripts

Rules:
1. Always write complete, runnable code
2. Include error handling at system boundaries
3. Comment only where logic is non-obvious
4. If given a bug, diagnose root cause first
5. Prefer simple solutions over clever ones
6. Never ask for clarification — make the best decision and note your assumption`
      },
      ...(context ? [{ role: 'user', content: `Context:\n${context}` }] : []),
      { role: 'user', content: task }
    ]
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const result = parsed.choices[0].message.content;
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Log output to file
async function ariannaWithLog(task, context = '') {
  console.log(`\n[ARIANNA] Task: ${task}\n${'─'.repeat(60)}`);
  const result = await arianna(task, context);
  console.log(result);

  // Save to output log
  const logDir = 'Z:\\openclaw\\workspace\\agents\\arianna\\logs';
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logDir, `${timestamp}.md`);
  fs.writeFileSync(logFile, `# Arianna Task — ${new Date().toLocaleString()}\n\n**Task:** ${task}\n\n**Output:**\n${result}`);
  console.log(`\n[Saved to ${logFile}]`);

  return result;
}

// CLI mode
if (require.main === module) {
  const task = process.argv.slice(2).join(' ');
  if (!task) {
    console.log('Usage: node arianna.js "your coding task here"');
    process.exit(0);
  }
  ariannaWithLog(task).catch(console.error);
}

module.exports = { arianna, ariannaWithLog };
