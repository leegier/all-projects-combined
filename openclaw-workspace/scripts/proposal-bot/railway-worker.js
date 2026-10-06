#!/usr/bin/env node
/**
 * railway-worker.js — MAX Bounty Hunter (Railway cloud deployment)
 *
 * Runs on Railway cron every 4 hours. No browser required.
 * Sources: GitHub issues with bounty labels + Algora.io
 * Brain: claude-sonnet-4-6
 * Reports: Telegram → Lee's phone
 *
 * Railway env vars needed:
 *   ANTHROPIC_API_KEY   — from console.anthropic.com
 *   TELEGRAM_BOT_TOKEN  — 8612410913:AAFxCwAs3yUSHKSnhM7IDR3EcE33QWheIjI
 *   TELEGRAM_CHAT_ID    — Lee's chat ID (send /start to the bot to get it)
 */

import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-oat01-REDACTED';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8612410913:AAFxCwAs3yUSHKSnhM7IDR3EcE33QWheIjI';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const MODEL = 'claude-sonnet-4-6';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Profile used in proposal generation
const PROFILE = {
  name: 'Lee Gierl',
  title: 'Full-Stack Developer | AI Automation | Node.js / Python / React',
  rate: 65,
  skills: ['React', 'Node.js', 'Python', 'TypeScript', 'REST APIs', 'PostgreSQL',
           'AI/ML integration', 'browser automation', 'Playwright', 'Unity C#', 'WebGL'],
  strengths: [
    'Ships fast, clean code — no bloat',
    '10+ years building production systems',
    'Autonomous AI tooling and workflow automation specialist',
    'Open source contributor with real deployed projects',
  ],
};

// ── GitHub bounty hunter ──────────────────────────────────────────────────────

async function fetchGitHubBounties() {
  const queries = [
    'label:bounty+state:open+language:javascript',
    'label:bounty+state:open+language:python',
    'label:bounty+state:open+language:typescript',
    'label:"good first issue"+label:bounty+state:open',
    'label:hacktoberfest+label:bounty+state:open',
  ];

  const results = [];
  const seen = new Set();

  for (const q of queries) {
    try {
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=10`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'MAX-BountyBot/1.0',
          ...(process.env.GITHUB_TOKEN ? { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        },
      });

      if (!res.ok) {
        console.warn(`[GitHub] Query failed (${res.status}): ${q}`);
        continue;
      }

      const data = await res.json();
      for (const issue of (data.items || [])) {
        if (seen.has(issue.html_url)) continue;
        seen.add(issue.html_url);

        results.push({
          id: String(issue.id),
          platform: 'github',
          title: issue.title,
          description: issue.body?.slice(0, 1000) || '',
          url: issue.html_url,
          repo: issue.repository_url?.replace('https://api.github.com/repos/', ''),
          labels: issue.labels?.map(l => l.name) || [],
          createdAt: issue.created_at,
          budget: extractBountyAmount(issue.body || '', issue.labels || []),
        });
      }

      await sleep(1000); // respect rate limits
    } catch (e) {
      console.error(`[GitHub] Error: ${e.message}`);
    }
  }

  return results;
}

function extractBountyAmount(body, labels) {
  // Try to find dollar amounts in body or label names
  const labelMatch = labels.find(l => l.name?.match(/\$[\d,]+/));
  if (labelMatch) return labelMatch.name;

  const bodyMatch = body.match(/\$[\d,]+/);
  if (bodyMatch) return bodyMatch[0];

  return 'bounty (amount unspecified)';
}

// ── Algora bounty hunter ──────────────────────────────────────────────────────

async function fetchAlgoraBounties() {
  try {
    const res = await fetch('https://console.algora.io/api/bounties?status=open&limit=20', {
      headers: { 'User-Agent': 'MAX-BountyBot/1.0' },
    });

    if (!res.ok) {
      console.warn(`[Algora] API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const bounties = data.data || data.bounties || data || [];

    return bounties.slice(0, 20).map(b => ({
      id: String(b.id || b.issue_id),
      platform: 'algora',
      title: b.title || b.issue_title || 'Untitled',
      description: b.description || b.issue_body || '',
      url: b.url || b.issue_url || `https://console.algora.io/bounties/${b.id}`,
      repo: b.repo || b.repository,
      budget: b.amount ? `$${b.amount}` : 'unspecified',
      createdAt: b.created_at,
    }));
  } catch (e) {
    console.warn(`[Algora] Failed: ${e.message}`);
    return [];
  }
}

// ── Score + generate ──────────────────────────────────────────────────────────

async function scoreJob(job) {
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 100,
      system: `You are a relevance scorer. Developer skills: ${PROFILE.skills.join(', ')}.
Rate this bounty/issue for fit. Respond JSON only: {"score":<1-10>,"reason":"<one sentence>"}
1-5 = skip. 6-7 = maybe. 8-10 = apply.`,
      messages: [{
        role: 'user',
        content: `Title: ${job.title}\nDesc: ${job.description.slice(0, 600)}\nBudget: ${job.budget}\nLabels: ${(job.labels || []).join(', ')}`,
      }],
    });

    const raw = msg.content[0].text.trim();
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
    return parsed;
  } catch {
    return { score: 0, reason: 'scoring failed' };
  }
}

async function generateProposal(job) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 350,
    system: `Write a GitHub issue comment as a developer offering to fix this bounty.
Max 120 words. Rules:
- Open with one specific observation about the issue
- State your directly relevant experience (specific, not vague)
- Ask one smart technical question that shows you've read it
- Close: "Happy to start immediately with a small proof-of-concept."
- NO greetings, NO emojis, NO "I am passionate"
Sound like someone who has fixed this exact thing before.

Skills: ${PROFILE.skills.join(', ')}
Strengths: ${PROFILE.strengths.join(' | ')}`,
    messages: [{
      role: 'user',
      content: `Write a proposal for:\nTitle: ${job.title}\nRepo: ${job.repo || 'unknown'}\nDesc: ${job.description.slice(0, 800)}\nBudget: ${job.budget}`,
    }],
  });

  return msg.content[0].text.trim();
}

// ── Telegram ──────────────────────────────────────────────────────────────────

async function notify(text) {
  if (!TELEGRAM_CHAT_ID) {
    console.log(`[Telegram] No TELEGRAM_CHAT_ID set. Would send:\n${text}`);
    return;
  }

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  }).catch(e => console.error(`[Telegram] ${e.message}`));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const ts = new Date().toISOString();
  console.log(`[MAX BountyBot] Starting run at ${ts}`);

  // Fetch from all sources
  const [githubBounties, algoraBounties] = await Promise.all([
    fetchGitHubBounties(),
    fetchAlgoraBounties(),
  ]);

  const all = [...githubBounties, ...algoraBounties];
  console.log(`[MAX BountyBot] Found ${all.length} bounties (${githubBounties.length} GitHub, ${algoraBounties.length} Algora)`);

  if (all.length === 0) {
    console.log('[MAX BountyBot] No bounties found this run.');
    return;
  }

  // Score all
  const scored = [];
  for (const job of all) {
    const { score, reason } = await scoreJob(job);
    console.log(`[Score] ${score}/10 ${job.title.slice(0, 50)} | ${reason}`);
    if (score >= 7) scored.push({ ...job, score, reason });
    await sleep(500);
  }

  scored.sort((a, b) => b.score - a.score);
  console.log(`[MAX BountyBot] ${scored.length} bounties passed scoring`);

  if (scored.length === 0) {
    console.log('[MAX BountyBot] Nothing scored high enough this run.');
    return;
  }

  // Generate proposals for top 3
  const top = scored.slice(0, 3);
  let sent = 0;

  for (const job of top) {
    try {
      const proposal = await generateProposal(job);

      const message = `🎯 *Bounty Found — Score ${job.score}/10*
Platform: ${job.platform.toUpperCase()}
Repo: ${job.repo || 'unknown'}
Budget: ${job.budget}
${job.url}

*Proposed reply:*
\`\`\`
${proposal.slice(0, 800)}
\`\`\`

_Post this comment to claim the bounty._`;

      await notify(message);
      sent++;

      console.log(`[MAX BountyBot] Notified: ${job.title}`);
      await sleep(2000);
    } catch (e) {
      console.error(`[MAX BountyBot] Failed on ${job.title}: ${e.message}`);
    }
  }

  // Run summary
  await notify(`📊 *MAX BountyBot Run Complete* — ${ts.slice(0, 16).replace('T', ' ')}
Found: ${all.length} bounties
Qualified: ${scored.length}
Proposals sent to Telegram: ${sent}`);

  console.log(`[MAX BountyBot] Done. ${sent} proposals sent.`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

run().catch(e => {
  console.error(`[MAX BountyBot] FATAL: ${e.message}`);
  process.exit(1);
});
