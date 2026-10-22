// caller.js — Calls individual models and returns normalized {content, null}
// Handles Ollama and OpenRouter formats. Returns null on any failure.

import fetch from 'node-fetch';

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ||
  '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';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ||
  'sk-ant-oat01-REDACTED';

const TIMEOUT_MS = 25000;

function signal() {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return ctrl.signal;
}

// ── Ollama ────────────────────────────────────────────────────────────────────

export async function callOllama(model, messages, options = {}) {
  const url = `${model.endpoint}/api/chat`;
  const body = {
    model: model.model,
    messages,
    stream: false,
    options: {
      num_ctx: Math.min(model.contextWindow || 16384, options.maxTokens ? options.maxTokens * 4 : 16384),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: signal(),
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const content = data?.message?.content;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Ollama returned empty content');
  }
  return content;
}

// ── OpenRouter ────────────────────────────────────────────────────────────────

export async function callOpenRouter(model, messages, options = {}) {
  const url = `${model.endpoint}/chat/completions`;
  const body = {
    model: model.model,
    messages,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.7,
    stream: false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://openclaw.local',
      'X-Title': 'MAX-Router',
    },
    body: JSON.stringify(body),
    signal: signal(),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);

  const data = await res.json();

  // Reasoning models return content: null — treat as failure
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    const reasoning = data?.choices?.[0]?.message?.reasoning;
    if (reasoning) {
      throw new Error(`Model returned reasoning-only (content: null) — not an instruction model`);
    }
    throw new Error('OpenRouter returned empty content');
  }

  return content;
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

export async function callAnthropic(model, messages, options = {}) {
  const url = `${model.endpoint}/v1/messages`;

  // Anthropic separates system messages from the messages array
  const systemMsgs = messages.filter(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role !== 'system');

  const body = {
    model: model.model,
    max_tokens: options.maxTokens || 2048,
    messages: userMsgs,
    ...(systemMsgs.length > 0 && { system: systemMsgs.map(m => m.content).join('\n') }),
  };

  // sk-ant-oat01- keys are OAuth Access Tokens — use Authorization: Bearer
  // sk-ant-api03- keys are API keys — use x-api-key
  const isOAuthToken = ANTHROPIC_KEY.startsWith('sk-ant-oat');
  const authHeaders = isOAuthToken
    ? { 'Authorization': `Bearer ${ANTHROPIC_KEY}` }
    : { 'x-api-key': ANTHROPIC_KEY };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: signal(),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const content = data?.content?.[0]?.text;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Anthropic returned empty content');
  }
  return content;
}

// ── Unified caller ────────────────────────────────────────────────────────────

export async function callModel(model, messages, options = {}) {
  if (model.type === 'anthropic') return callAnthropic(model, messages, options);
  if (model.type === 'ollama') return callOllama(model, messages, options);
  if (model.type === 'openrouter') return callOpenRouter(model, messages, options);
  throw new Error(`Unknown model type: ${model.type}`);
}
