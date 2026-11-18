// router.js — Smart router + execution loop
// Routes to ranked models, retries on failure, never gives up until all exhausted.

import { getRanked, recordSuccess, recordFailure, resetIfRecoverable, REGISTRY } from './registry.js';
import { callModel } from './caller.js';

const MAX_RETRIES_PER_MODEL = 1;
const RETRY_DELAY_BASE_MS = 500;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Main entry point — returns { content, modelId } or throws if all models fail
export async function route(messages, options = {}) {
  const ranked = getRanked();
  const errors = [];

  for (const model of ranked) {
    for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      const start = Date.now();
      try {
        const content = await callModel(model, messages, options);
        recordSuccess(model.id, Date.now() - start);
        console.log(`[Router] ✓ ${model.id} (${Date.now() - start}ms)`);
        return { content, modelId: model.id };
      } catch (err) {
        const msg = err.message || String(err);
        console.warn(`[Router] ✗ ${model.id} attempt ${attempt + 1}: ${msg}`);
        errors.push({ model: model.id, error: msg });

        if (attempt < MAX_RETRIES_PER_MODEL) {
          await sleep(RETRY_DELAY_BASE_MS * (attempt + 1));
        } else {
          recordFailure(model.id, err);
        }
      }
    }
  }

  // All models failed. Try to reset any that have been down for a while.
  REGISTRY.forEach(m => resetIfRecoverable(m.id));

  const summary = errors.map(e => `${e.model}: ${e.error}`).join(' | ');
  throw new Error(`All models failed. Errors: ${summary}`);
}

// Lightweight check for health monitor — just asks for "OK"
export async function probe(model) {
  const start = Date.now();
  try {
    await callModel(model, [{ role: 'user', content: 'Respond with the word OK.' }], { maxTokens: 10 });
    recordSuccess(model.id, Date.now() - start);
    return true;
  } catch (err) {
    recordFailure(model.id, err);
    return false;
  }
}
