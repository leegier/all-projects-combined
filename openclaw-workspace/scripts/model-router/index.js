#!/usr/bin/env node
// index.js — OpenAI-compatible proxy server
// OpenClaw points to this as an Ollama endpoint. All routing happens internally.
//
// Setup in openclaw.json:
//   providers.ollama.baseUrl = "http://127.0.0.1:11435"
//   Then add model: { id: "router:auto", name: "MAX Router" }
//   Set primary model to "ollama/router:auto"
//
// Or: just add http://127.0.0.1:11435 as a model endpoint directly.
//
// Run: node index.js
// Port: 11435 (to not conflict with Ollama's 11434)

import express from 'express';
import { route } from './router.js';
import { startMonitor, getStatus } from './health.js';
import { REGISTRY } from './registry.js';

const PORT = process.env.ROUTER_PORT || 11435;
const app = express();
app.use(express.json({ limit: '10mb' }));

// ── OpenAI-compatible endpoints ───────────────────────────────────────────────

// POST /v1/chat/completions — main endpoint (what OpenClaw calls)
app.post('/v1/chat/completions', async (req, res) => {
  const { messages, max_tokens, temperature, stream } = req.body;

  if (stream) {
    // Streaming not supported — return error, OpenClaw will fall back
    return res.status(422).json({ error: { message: 'Streaming not supported by MAX router' } });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: { message: 'messages array required' } });
  }

  try {
    const { content, modelId } = await route(messages, { maxTokens: max_tokens, temperature });

    // Return OpenAI-compatible response
    res.json({
      id: `router-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelId,
      choices: [{
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: Math.round(JSON.stringify(messages).length / 4),
        completion_tokens: Math.round(content.length / 4),
        total_tokens: Math.round((JSON.stringify(messages).length + content.length) / 4),
      },
    });
  } catch (err) {
    console.error('[Router] All models failed:', err.message);
    res.status(503).json({
      error: {
        message: err.message,
        type: 'all_models_failed',
      },
    });
  }
});

// GET /v1/models — model list (OpenAI compatible)
app.get('/v1/models', (req, res) => {
  const models = REGISTRY.map(m => ({
    id: m.id,
    object: 'model',
    created: 0,
    owned_by: m.type,
    permission: [],
    root: m.id,
    healthy: m.healthy,
    avgLatency: m.avgLatency,
  }));

  res.json({ object: 'list', data: models });
});

// ── Ollama-compatible endpoints (for OpenClaw Ollama provider) ────────────────

// POST /api/chat — Ollama format
app.post('/api/chat', async (req, res) => {
  const { messages, stream } = req.body;

  try {
    const { content, modelId } = await route(messages || []);

    if (stream) {
      // Ollama streaming: NDJSON chunks followed by done
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.write(JSON.stringify({
        model: modelId,
        created_at: new Date().toISOString(),
        message: { role: 'assistant', content },
        done: false,
      }) + '\n');
      res.write(JSON.stringify({
        model: modelId,
        created_at: new Date().toISOString(),
        message: { role: 'assistant', content: '' },
        done: true,
        done_reason: 'stop',
      }) + '\n');
      res.end();
    } else {
      res.json({
        model: modelId,
        created_at: new Date().toISOString(),
        message: { role: 'assistant', content },
        done: true,
      });
    }
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// POST /api/generate — Ollama generate format
app.post('/api/generate', async (req, res) => {
  const { prompt, system } = req.body;
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt || '' });

  try {
    const { content, modelId } = await route(messages);
    res.json({
      model: modelId,
      created_at: new Date().toISOString(),
      response: content,
      done: true,
    });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// GET /api/tags — list "models" in Ollama format
app.get('/api/tags', (req, res) => {
  res.json({
    models: REGISTRY.map(m => ({
      name: m.id,
      model: m.id,
      modified_at: new Date().toISOString(),
      size: 0,
      details: { family: m.type, parameter_size: 'varies', quantization_level: 'N/A' },
    })),
  });
});

// ── Status endpoints ──────────────────────────────────────────────────────────

app.get('/status', (req, res) => res.json({ status: 'ok', models: getStatus() }));
app.get('/health', (req, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  MAX MODEL ROUTER — port ${PORT}`);
  console.log(`  OpenAI: http://127.0.0.1:${PORT}/v1/chat/completions`);
  console.log(`  Ollama: http://127.0.0.1:${PORT}/api/chat`);
  console.log(`  Status: http://127.0.0.1:${PORT}/status`);
  console.log(`${'='.repeat(60)}\n`);

  startMonitor();
});
