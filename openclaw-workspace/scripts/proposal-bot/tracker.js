// tracker.js — Tracks submitted proposals, prevents duplicate sends
// Also handles follow-up scheduling

import fs from 'fs-extra';
import path from 'path';
import { CONFIG } from './config.js';

const SUBMITTED_FILE = path.join(CONFIG.paths.submitted, 'submitted.json');
const PROPOSALS_DIR = CONFIG.paths.proposals;

// Returns Set of "platform:jobId" strings
export async function readSubmitted() {
  try {
    await fs.ensureDir(CONFIG.paths.submitted);
    const data = await fs.readJson(SUBMITTED_FILE).catch(() => ({ entries: [] }));
    return new Set(data.entries.map(e => e.key));
  } catch {
    return new Set();
  }
}

export async function markSubmitted(job, proposal, result) {
  await fs.ensureDir(CONFIG.paths.submitted);
  const data = await fs.readJson(SUBMITTED_FILE).catch(() => ({ entries: [] }));

  const entry = {
    key: `${job.platform}:${job.id}`,
    platform: job.platform,
    jobId: job.id,
    title: job.title,
    url: job.url,
    proposal: proposal,
    submittedAt: new Date().toISOString(),
    followUpAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days
    followed: false,
    result,
  };

  data.entries.push(entry);
  await fs.writeJson(SUBMITTED_FILE, data, { spaces: 2 });

  // Also save full proposal text
  await fs.ensureDir(PROPOSALS_DIR);
  const filename = `${job.platform}-${job.id}-${Date.now()}.txt`;
  await fs.writeFile(
    path.join(PROPOSALS_DIR, filename),
    `JOB: ${job.title}\nURL: ${job.url}\nDATE: ${entry.submittedAt}\n\n${proposal}`
  );

  return entry;
}

// Get proposals due for follow-up (4+ days old, no reply marked)
export async function getFollowUpQueue() {
  const data = await fs.readJson(SUBMITTED_FILE).catch(() => ({ entries: [] }));
  const now = new Date();
  return data.entries.filter(e => !e.followed && new Date(e.followUpAt) <= now);
}

export async function markFollowedUp(key) {
  const data = await fs.readJson(SUBMITTED_FILE).catch(() => ({ entries: [] }));
  const entry = data.entries.find(e => e.key === key);
  if (entry) {
    entry.followed = true;
    entry.followedAt = new Date().toISOString();
    await fs.writeJson(SUBMITTED_FILE, data, { spaces: 2 });
  }
}

// Summary stats for Telegram reporting
export async function getStats() {
  const data = await fs.readJson(SUBMITTED_FILE).catch(() => ({ entries: [] }));
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  return {
    total: data.entries.length,
    thisWeek: data.entries.filter(e => new Date(e.submittedAt) > weekAgo).length,
    pendingFollowUp: data.entries.filter(e => !e.followed && new Date(e.followUpAt) <= now).length,
    byPlatform: {
      upwork: data.entries.filter(e => e.platform === 'upwork').length,
      fiverr: data.entries.filter(e => e.platform === 'fiverr').length,
    },
  };
}
