#!/usr/bin/env node
// index.js — Proposal bot orchestrator
// MAX calls this. It scrapes, scores, generates, submits, follows up.
//
// Usage:
//   node index.js                          -- full run (scrape + score + generate + submit)
//   node index.js --mode=scrape            -- scrape only, save to disk
//   node index.js --mode=generate          -- generate proposals for scraped jobs
//   node index.js --mode=submit            -- submit all generated proposals
//   node index.js --mode=followup          -- send follow-ups for aged proposals
//   node index.js --mode=login-upwork      -- open browser for manual Upwork login
//   node index.js --mode=login-fiverr      -- open browser for manual Fiverr login
//   node index.js --mode=stats             -- print stats and exit

import { scrapeUpwork, scrapeUpworkJobDetail, scrapeFiverrRequests, saveUpworkSession, saveFiverrSession } from './scraper.js';
import { scoreJob, generateProposal, generateFollowUp } from './generator.js';
import { submitUpworkProposal, submitFiverrResponse } from './submitter.js';
import { markSubmitted, getFollowUpQueue, markFollowedUp, getStats } from './tracker.js';
import { notifyProposalSent, notifyProposalFailed, notifyRunComplete, notifyFollowUpSent, notifySessionNeeded } from './notify.js';
import { CONFIG, sleep, randomDelay } from './config.js';
import fs from 'fs-extra';

const args = process.argv.slice(2);
const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'full';

async function main() {
  console.log(`[ProposalBot] Mode: ${mode} | ${new Date().toISOString()}`);
  await fs.ensureDir(CONFIG.paths.sessions);
  await fs.ensureDir(CONFIG.paths.proposals);
  await fs.ensureDir(CONFIG.paths.submitted);
  await fs.ensureDir(CONFIG.paths.logs);

  if (mode === 'login-upwork') {
    await saveUpworkSession();
    return;
  }

  if (mode === 'login-fiverr') {
    await saveFiverrSession();
    return;
  }

  if (mode === 'stats') {
    const stats = await getStats();
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  if (mode === 'followup') {
    await runFollowUps();
    return;
  }

  // Full run or individual stages
  let jobs = [];

  if (mode === 'full' || mode === 'scrape') {
    jobs = await scrapeAllPlatforms();
    if (mode === 'scrape') {
      const out = CONFIG.paths.proposals + '/scraped-latest.json';
      await fs.writeJson(out, jobs, { spaces: 2 });
      console.log(`[ProposalBot] Scraped ${jobs.length} jobs → ${out}`);
      return;
    }
  }

  if (mode === 'full' || mode === 'generate' || mode === 'submit') {
    if (mode === 'generate' || mode === 'submit') {
      // Load previously scraped jobs
      const f = CONFIG.paths.proposals + '/scraped-latest.json';
      jobs = await fs.readJson(f).catch(() => []);
    }

    const scored = await scoreAndFilter(jobs);
    console.log(`[ProposalBot] ${scored.length} jobs passed scoring (of ${jobs.length})`);

    if (mode === 'generate') {
      for (const job of scored) {
        const proposal = await generateProposal(job);
        console.log(`\n=== ${job.platform.toUpperCase()}: ${job.title} ===\n${proposal}\n`);
      }
      return;
    }

    // Full or submit
    await submitProposals(scored);
  }
}

async function scrapeAllPlatforms() {
  const all = [];

  // Upwork — all keywords
  if (CONFIG.profile.upwork.username || await fs.pathExists(CONFIG.profile.upwork.sessionFile)) {
    for (const keyword of CONFIG.search.upwork.keywords) {
      console.log(`[Upwork] Scraping: ${keyword}`);
      const jobs = await scrapeUpwork(keyword);
      all.push(...jobs);
      await sleep(randomDelay(CONFIG.delays.betweenJobs));
    }
  } else {
    console.warn('[Upwork] No session. Run --mode=login-upwork first.');
    await notifySessionNeeded('Upwork');
  }

  // Fiverr buyer requests
  if (CONFIG.profile.fiverr.username || await fs.pathExists(CONFIG.profile.fiverr.sessionFile)) {
    for (const cat of CONFIG.search.fiverr.buyerRequests) {
      console.log(`[Fiverr] Scraping buyer requests: ${cat}`);
      const reqs = await scrapeFiverrRequests(cat);
      all.push(...reqs);
      await sleep(randomDelay(CONFIG.delays.betweenJobs));
    }
  } else {
    console.warn('[Fiverr] No session. Run --mode=login-fiverr first.');
    await notifySessionNeeded('Fiverr');
  }

  // Dedupe by platform:id
  const seen = new Set();
  return all.filter(j => {
    const key = `${j.platform}:${j.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scoreAndFilter(jobs) {
  const scored = [];

  for (const job of jobs) {
    const { score, reason } = await scoreJob(job);
    console.log(`[Score] ${score}/10 — ${job.title.slice(0, 50)} | ${reason}`);

    if (score >= 7) {
      scored.push({ ...job, score });
    }

    await sleep(randomDelay([500, 1500]));
  }

  // Sort highest score first
  return scored.sort((a, b) => b.score - a.score);
}

async function submitProposals(jobs) {
  let submitted = 0;

  for (const job of jobs) {
    if (submitted >= CONFIG.maxProposalsPerRun) {
      console.log(`[ProposalBot] Hit max ${CONFIG.maxProposalsPerRun} proposals for this run.`);
      break;
    }

    console.log(`[Generate] ${job.platform}: ${job.title}`);

    // Enrich Upwork jobs with full description
    if (job.platform === 'upwork' && job.url) {
      const detail = await scrapeUpworkJobDetail(job.url);
      if (detail.description) job.description = detail.description;
      Object.assign(job, detail);
    }

    const proposal = await generateProposal(job);
    console.log(`[Proposal]\n${proposal}\n`);

    await sleep(randomDelay(CONFIG.delays.betweenJobs));

    let result;
    if (job.platform === 'upwork') {
      result = await submitUpworkProposal(job, proposal);
    } else if (job.platform === 'fiverr') {
      result = await submitFiverrResponse(job, proposal);
    }

    if (result?.success) {
      await markSubmitted(job, proposal, result);
      await notifyProposalSent(job, proposal);
      submitted++;
      console.log(`[Submit] ✅ ${job.platform}: ${job.title}`);
    } else {
      await notifyProposalFailed(job, result?.error || 'unknown error');
      console.error(`[Submit] ❌ ${job.platform}: ${job.title} — ${result?.error}`);
    }

    await sleep(randomDelay(CONFIG.delays.afterSubmit));
  }

  const stats = await getStats();
  await notifyRunComplete(stats, submitted);
  console.log(`[ProposalBot] Done. Sent ${submitted} proposals.`);
}

async function runFollowUps() {
  const queue = await getFollowUpQueue();
  console.log(`[FollowUp] ${queue.length} proposals due for follow-up`);

  for (const entry of queue.slice(0, 3)) { // max 3 follow-ups per run
    const { generateFollowUp: gen } = await import('./generator.js');
    const followUpText = await generateFollowUp(
      { title: entry.title, platform: entry.platform },
      entry.proposal
    );

    console.log(`[FollowUp] ${entry.platform}: ${entry.title}\n${followUpText}\n`);
    // Note: Upwork follow-up via message thread would need the contract/proposal URL
    // For now: log + notify, manual send if needed
    await notifyFollowUpSent(entry);
    await markFollowedUp(entry.key);
    await sleep(randomDelay(CONFIG.delays.afterSubmit));
  }
}

main().catch(e => {
  console.error(`[ProposalBot] Fatal: ${e.message}`);
  process.exit(1);
});
