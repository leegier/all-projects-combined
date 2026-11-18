#!/usr/bin/env node
/**
 * MODEL FAILOVER CHAIN - "The Engine"
 * 
 * Tries models in priority order. If one fails (auth expired, rate limit, 
 * timeout, error), cascades to the next. Logs which worked and which didn't.
 * 
 * Chain: Claude Sonnet 4 (OpenRouter) -> MiniMax M2.5 (OpenRouter) -> Qwen3 235B (OpenRouter) -> Qwen3 Coder FREE -> MiniMax FREE -> OpenRouter Free Auto
 * 
 * Usage:
 *   node model-failover.js "Your prompt here"
 *   node model-failover.js --test                    (tests all models)
 *   node model-failover.js --status                  (shows last known status)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'model-failover.log');
const STATUS_FILE = path.join(__dirname, 'model-status.json');

// ── MODEL CHAIN (ordered by preference) ──────────────────────────────
// All models route through OpenRouter — no local GPU or Anthropic subscription needed.
const MODEL_CHAIN = [
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4 (OpenRouter)',
    type: 'openrouter',
    model: 'anthropic/claude-sonnet-4',
    baseUrl: 'https://openrouter.ai',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    tier: 'premium',
    maxTokens: 4096,
  },
  {
    id: 'minimax-m2.5',
    name: 'MiniMax M2.5 (OpenRouter - Cheap)',
    type: 'openrouter',
    model: 'minimax/minimax-m2.5',
    baseUrl: 'https://openrouter.ai',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    tier: 'standard',
    maxTokens: 4096,
  },
  {
    id: 'qwen3-235b',
    name: 'Qwen3 235B (OpenRouter - Strong Coder)',
    type: 'openrouter',
    model: 'qwen/qwen3-235b-a22b',
    baseUrl: 'https://openrouter.ai',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    tier: 'standard',
    maxTokens: 4096,
  },
  {
    id: 'qwen3-coder-free',
    name: 'Qwen3 Coder (OpenRouter - FREE)',
    type: 'openrouter',
    model: 'qwen/qwen3-coder:free',
    baseUrl: 'https://openrouter.ai',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    tier: 'free',
    maxTokens: 2048,
  },
  {
    id: 'minimax-m2.5-free',
    name: 'MiniMax M2.5 (OpenRouter - FREE)',
    type: 'openrouter',
    model: 'minimax/minimax-m2.5:free',
    baseUrl: 'https://openrouter.ai',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    tier: 'free',
    maxTokens: 2048,
  },
  {
    id: 'openrouter-free',
    name: 'OpenRouter Free Auto-Router',
    type: 'openrouter',
    model: 'openrouter/free',
    baseUrl: 'https://openrouter.ai',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    tier: 'free',
    maxTokens: 2048,
  },
];

// ── LOGGING ──────────────────────────────────────────────────────────
function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function updateStatus(modelId, status, error = null, latencyMs = null) {
  let statuses = {};
  try { statuses = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); } catch {}
  
  statuses[modelId] = {
    status,
    error: error ? String(error).substring(0, 200) : null,
    latencyMs,
    lastChecked: new Date().toISOString(),
    ...(status === 'ok' ? { lastSuccess: new Date().toISOString() } : {}),
    ...(statuses[modelId]?.lastSuccess ? { lastSuccess: statuses[modelId].lastSuccess } : {}),
  };
  
  fs.writeFileSync(STATUS_FILE, JSON.stringify(statuses, null, 2));
}

// ── API CALLERS ──────────────────────────────────────────────────────
function callOpenRouter(model, prompt, apiKey, maxTokens) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: model.model,
      max_tokens: maxTokens || 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://openclaw.ai',
        'X-Title': 'OpenClaw Model Failover',
      },
      timeout: 60000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(body);
            const text = json.choices?.[0]?.message?.content || 'No response text';
            resolve(text);
          } catch (e) { reject(`Parse error: ${e.message}`); }
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          reject(`AUTH_EXPIRED: HTTP ${res.statusCode} - OpenRouter API key invalid`);
        } else if (res.statusCode === 429) {
          reject(`RATE_LIMITED: HTTP 429 - Rate limit exceeded`);
        } else if (res.statusCode >= 500) {
          reject(`SERVER_ERROR: HTTP ${res.statusCode} - ${body.substring(0, 100)}`);
        } else {
          reject(`HTTP_ERROR: ${res.statusCode} - ${body.substring(0, 200)}`);
        }
      });
    });

    req.on('error', (e) => reject(`CONNECTION_ERROR: ${e.message}`));
    req.on('timeout', () => { req.destroy(); reject('TIMEOUT: Request timed out after 60s'); });
    req.write(data);
    req.end();
  });
}

function callAnthropic(model, prompt, apiKey, maxTokens) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: model.model,
      max_tokens: maxTokens || 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      timeout: 30000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(body);
            resolve(json.content?.[0]?.text || 'No response text');
          } catch (e) { reject(`Parse error: ${e.message}`); }
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          reject(`AUTH_EXPIRED: HTTP ${res.statusCode} - API key invalid or expired`);
        } else if (res.statusCode === 429) {
          reject(`RATE_LIMITED: HTTP 429 - Rate limit exceeded`);
        } else if (res.statusCode === 529) {
          reject(`OVERLOADED: HTTP 529 - API overloaded`);
        } else if (res.statusCode >= 500) {
          reject(`SERVER_ERROR: HTTP ${res.statusCode} - ${body.substring(0, 100)}`);
        } else {
          reject(`HTTP_ERROR: ${res.statusCode} - ${body.substring(0, 200)}`);
        }
      });
    });

    req.on('error', (e) => reject(`CONNECTION_ERROR: ${e.message}`));
    req.on('timeout', () => { req.destroy(); reject('TIMEOUT: Request timed out after 30s'); });
    req.write(data);
    req.end();
  });
}

function callOllama(model, prompt, maxTokens) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: model.model,
      prompt: prompt,
      stream: false,
      options: { num_predict: maxTokens || 1024 },
    });

    const req = http.request({
      hostname: 'localhost',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000, // Local models can be slower
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(body);
            resolve(json.response || 'No response');
          } catch (e) { reject(`Parse error: ${e.message}`); }
        } else {
          reject(`OLLAMA_ERROR: HTTP ${res.statusCode} - ${body.substring(0, 200)}`);
        }
      });
    });

    req.on('error', (e) => reject(`OLLAMA_DOWN: ${e.message} - Is Ollama running?`));
    req.on('timeout', () => { req.destroy(); reject('OLLAMA_TIMEOUT: Model took too long (120s)'); });
    req.write(data);
    req.end();
  });
}

// ── MAIN FAILOVER LOGIC ─────────────────────────────────────────────
async function failoverQuery(prompt) {
  log(`=== NEW REQUEST ===`);
  log(`Prompt: "${prompt.substring(0, 80)}..."`);
  
  for (const model of MODEL_CHAIN) {
    log(`Trying: ${model.name} (${model.id})...`);
    const start = Date.now();
    
    try {
      let response;
      
      if (model.type === 'openrouter') {
        const apiKey = process.env[model.apiKeyEnv];
        if (!apiKey) {
          const err = `NO_API_KEY: ${model.apiKeyEnv} not set`;
          log(`  SKIP: ${err}`);
          updateStatus(model.id, 'skipped', err);
          continue;
        }
        response = await callOpenRouter(model, prompt, apiKey, model.maxTokens);
      } else if (model.type === 'anthropic') {
        const apiKey = process.env[model.apiKeyEnv];
        if (!apiKey) {
          const err = `NO_API_KEY: ${model.apiKeyEnv} not set`;
          log(`  SKIP: ${err}`);
          updateStatus(model.id, 'skipped', err);
          continue;
        }
        response = await callAnthropic(model, prompt, apiKey, model.maxTokens);
      } else if (model.type === 'ollama') {
        response = await callOllama(model, prompt, model.maxTokens);
      }
      
      const latency = Date.now() - start;
      log(`  SUCCESS: ${model.name} responded in ${latency}ms`);
      updateStatus(model.id, 'ok', null, latency);
      
      // Report back which model worked
      log(`  >>> MODEL THAT WORKED: ${model.name} (${model.id})`);
      log(`  >>> Response length: ${response.length} chars`);
      
      return { model: model.id, name: model.name, response, latencyMs: latency };
      
    } catch (error) {
      const latency = Date.now() - start;
      log(`  FAILED: ${error}`);
      updateStatus(model.id, 'failed', error, latency);
      
      // Continue to next model
      log(`  Cascading to next model...`);
    }
  }
  
  log(`!!! ALL MODELS FAILED !!! No response could be generated.`);
  return { model: null, name: 'NONE', response: 'ERROR: All models in the chain failed. Check model-failover.log for details.', latencyMs: 0 };
}

// ── TEST ALL MODELS ─────────────────────────────────────────────────
async function testAllModels() {
  log(`=== TESTING ALL MODELS ===`);
  const testPrompt = 'Say "Hello from [your model name]" in one short sentence.';
  
  for (const model of MODEL_CHAIN) {
    log(`Testing: ${model.name}...`);
    const start = Date.now();
    
    try {
      let response;
      if (model.type === 'openrouter') {
        const apiKey = process.env[model.apiKeyEnv];
        if (!apiKey) {
          log(`  SKIP: No API key for ${model.apiKeyEnv}`);
          updateStatus(model.id, 'no_key', 'API key not set');
          continue;
        }
        response = await callOpenRouter(model, testPrompt, apiKey, 50);
      } else if (model.type === 'anthropic') {
        const apiKey = process.env[model.apiKeyEnv];
        if (!apiKey) {
          log(`  SKIP: No API key for ${model.apiKeyEnv}`);
          updateStatus(model.id, 'no_key', 'API key not set');
          continue;
        }
        response = await callAnthropic(model, testPrompt, apiKey, 50);
      } else {
        response = await callOllama(model, testPrompt, 50);
      }
      
      const latency = Date.now() - start;
      log(`  OK: "${response.substring(0, 100)}" (${latency}ms)`);
      updateStatus(model.id, 'ok', null, latency);
    } catch (error) {
      const latency = Date.now() - start;
      log(`  FAIL: ${error} (${latency}ms)`);
      updateStatus(model.id, 'failed', error, latency);
    }
  }
  
  log(`=== TEST COMPLETE ===`);
  showStatus();
}

// ── STATUS DISPLAY ──────────────────────────────────────────────────
function showStatus() {
  try {
    const statuses = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    console.log('\n=== MODEL STATUS ===');
    for (const model of MODEL_CHAIN) {
      const s = statuses[model.id] || { status: 'unknown' };
      const icon = s.status === 'ok' ? '✓' : s.status === 'failed' ? '✗' : s.status === 'skipped' ? '⊘' : '?';
      const latency = s.latencyMs ? `${s.latencyMs}ms` : 'N/A';
      const lastOk = s.lastSuccess ? new Date(s.lastSuccess).toLocaleString() : 'never';
      console.log(`  ${icon} ${model.name.padEnd(35)} | ${s.status.padEnd(10)} | ${latency.padEnd(8)} | Last OK: ${lastOk}`);
      if (s.error) console.log(`    └─ Error: ${s.error}`);
    }
    console.log('');
  } catch {
    console.log('No status data yet. Run --test first.');
  }
}

// ── ENTRY POINT ─────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    await testAllModels();
  } else if (args.includes('--status')) {
    showStatus();
  } else if (args.length > 0) {
    const prompt = args.join(' ');
    const result = await failoverQuery(prompt);
    console.log(`\n[Model: ${result.name}] [Latency: ${result.latencyMs}ms]`);
    console.log(result.response);
  } else {
    console.log('Usage:');
    console.log('  node model-failover.js "Your prompt"   - Query with failover');
    console.log('  node model-failover.js --test          - Test all models');
    console.log('  node model-failover.js --status        - Show model status');
  }
}

main().catch(console.error);
