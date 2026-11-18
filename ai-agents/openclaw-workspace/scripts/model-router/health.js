// health.js — Background health monitor
// Probes each model on an interval. Updates registry state automatically.

import { REGISTRY, resetIfRecoverable } from './registry.js';
import { probe } from './router.js';

const CHECK_INTERVAL_MS = 60_000;       // probe all models every 60s
const RECOVERY_CHECK_INTERVAL = 5;     // re-check unhealthy models every Nth cycle

let cycleCount = 0;
let intervalHandle = null;

async function runCycle() {
  cycleCount++;
  const results = [];

  for (const model of REGISTRY) {
    // Skip healthy models on odd cycles to reduce load — check unhealthy ones more often
    const isUnhealthy = !model.healthy;
    const shouldCheck = isUnhealthy || (cycleCount % RECOVERY_CHECK_INTERVAL === 0) || model.avgLatency === 0;

    if (!shouldCheck) {
      results.push({ id: model.id, skipped: true });
      continue;
    }

    if (isUnhealthy) resetIfRecoverable(model.id);

    const ok = await probe(model);
    results.push({ id: model.id, healthy: ok, latency: model.avgLatency });

    // Small gap between probes to not hammer local Ollama
    await new Promise(r => setTimeout(r, 200));
  }

  const healthy = results.filter(r => !r.skipped && r.healthy).map(r => r.id);
  const sick = results.filter(r => !r.skipped && !r.healthy).map(r => r.id);

  if (sick.length > 0) {
    console.log(`[Health] Cycle ${cycleCount}: ✓ ${healthy.join(', ')} | ✗ ${sick.join(', ')}`);
  } else {
    console.log(`[Health] Cycle ${cycleCount}: All checked models healthy`);
  }
}

export function startMonitor() {
  if (intervalHandle) return;
  // Run immediately on start
  runCycle().catch(e => console.error('[Health] Initial check failed:', e.message));
  intervalHandle = setInterval(() => {
    runCycle().catch(e => console.error('[Health] Cycle error:', e.message));
  }, CHECK_INTERVAL_MS);
  console.log(`[Health] Monitor started — checking every ${CHECK_INTERVAL_MS / 1000}s`);
}

export function stopMonitor() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export function getStatus() {
  return REGISTRY.map(m => ({
    id: m.id,
    type: m.type,
    model: m.model,
    healthy: m.healthy,
    failStreak: m.failStreak,
    avgLatency: m.avgLatency,
    successRate: Math.round(m.successRate * 100),
    lastCheck: m.lastCheck,
    lastError: m.lastError,
  }));
}
