/**
 * gumroad-upload.js — Automatically create Gumroad products via API
 * Run: node gumroad-upload.js
 * Requires: GUMROAD_ACCESS_TOKEN env var or set below
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

const ACCESS_TOKEN = process.env.GUMROAD_ACCESS_TOKEN || '';
const BASE_URL = 'https://api.gumroad.com/v2';

const PRODUCTS = [
  {
    name: 'FORGE Landing Page Template Pack — 22 Multi-Brand SaaS Pages',
    price: 2900, // cents
    description: `22 complete, standalone HTML landing pages — each with unique branding for a different marketing channel (Product Hunt, HN, Reddit, LinkedIn, Twitter, and more).

All 22 pages market the same product, positioned differently for each audience. Plug in your product name and deploy all 22 simultaneously.

What's included:
• 22 HTML files (no dependencies — pure HTML/CSS/JS)
• brands.config.json for bulk customization
• generate-brands.js — Node.js script to mass-customize all 22 pages at once
• MARKETING_STRATEGY.md — which channel to post each brand to
• MARKETING_PLAYBOOK.json — full launch playbook

Use case: Launch the same SaaS product to 22 different audiences simultaneously. One product, 22 angles, zero extra design work.`,
    tags: ['landing page', 'saas', 'marketing', 'template', 'html', 'product launch'],
    zipPath: 'Z:/openclaw/workspace/gumroad-products/FORGE-Landing-Page-Pack-v1.zip',
    published: true,
  },
  {
    name: 'Autonomous Agent Startup Pack — Full OpenClaw Config + Agent Runtime',
    price: 4900, // cents
    description: `Complete configuration files, workspace templates, and a working autonomous agent runtime to deploy your own AI agent that runs 24/7, earns money, builds software, and posts to Discord/Telegram.

What's included:
• BRIEF.md — ultra-compact bootstrap prompt that fits in any context window
• DIRECTIVES.md — agent standing orders and revenue mandate template
• SKILLS-GUIDE.md — 170+ skills with usage examples
• AGENTS.md — sub-agent team configuration (SCOUT, DEEP, INK, LINT, GHOST)
• PLATFORM_GIGS.md — copy-paste ready Fiverr/Upwork/itch.io/Gumroad listings
• agent-runtime/ — full Python async runtime: planner, DAG executor, SQLite persistence, orchestrator
• SETUP_GUIDE.md — 15-minute install guide with Telegram and Discord setup

Tech stack: Python 3.11+, aiosqlite, aiohttp, Ollama (local models), OpenClaw

Your agent will: plan goals into tasks, execute them in parallel, store results in SQLite, and report to you via Discord/Telegram.`,
    tags: ['ai agent', 'automation', 'openclaw', 'passive income', 'llm', 'ollama', 'python'],
    zipPath: 'Z:/openclaw/workspace/gumroad-products/Autonomous-Agent-Startup-Pack-v1.zip',
    published: true,
  },
];

async function createProduct(product) {
  console.log(`\nCreating: ${product.name}`);

  // Step 1: Create the product
  const createBody = new URLSearchParams({
    name: product.name,
    price: product.price,
    description: product.description,
    published: product.published ? 'true' : 'false',
  });

  const createResp = await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: createBody.toString(),
  });

  const created = await createResp.json();
  if (!created.success) {
    throw new Error(`Failed to create product: ${JSON.stringify(created)}`);
  }

  const productId = created.product.id;
  console.log(`  ✓ Product created: id=${productId}`);

  // Step 2: Upload the file
  console.log(`  Uploading: ${product.zipPath}`);
  const form = new FormData();
  form.append('file', fs.createReadStream(product.zipPath), {
    filename: path.basename(product.zipPath),
    contentType: 'application/zip',
  });

  const uploadResp = await fetch(`${BASE_URL}/products/${productId}/product_files`, {
    method: 'POST',
    body: form,
    headers: { ...form.getHeaders(), 'Authorization': `Bearer ${ACCESS_TOKEN}` },
  });

  const uploaded = await uploadResp.json();
  if (!uploaded.success) {
    throw new Error(`Failed to upload file: ${JSON.stringify(uploaded)}`);
  }

  console.log(`  ✓ File uploaded`);
  console.log(`  ✓ LIVE: https://gumroad.com/l/${created.product.short_url}`);

  return created.product;
}

async function main() {
  if (!ACCESS_TOKEN) {
    console.error('ERROR: GUMROAD_ACCESS_TOKEN not set.');
    console.error('Get it from: Gumroad → Settings → Advanced → Access Token');
    console.error('Then run: set GUMROAD_ACCESS_TOKEN=your_token && node gumroad-upload.js');
    process.exit(1);
  }

  console.log('=== Gumroad Product Upload ===');
  const results = [];

  for (const product of PRODUCTS) {
    try {
      const result = await createProduct(product);
      results.push({ name: product.name, url: `https://gumroad.com/l/${result.short_url}`, status: 'LIVE' });
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      results.push({ name: product.name, status: 'FAILED', error: err.message });
    }
  }

  console.log('\n=== Results ===');
  for (const r of results) {
    console.log(`${r.status === 'LIVE' ? '✓' : '✗'} ${r.name}`);
    if (r.url) console.log(`  URL: ${r.url}`);
    if (r.error) console.log(`  Error: ${r.error}`);
  }

  // Write results to workspace
  const log = JSON.stringify(results, null, 2);
  fs.writeFileSync('Z:/openclaw/workspace/gumroad-results.json', log);
  console.log('\nResults saved to Z:/openclaw/workspace/gumroad-results.json');
}

main().catch(console.error);
