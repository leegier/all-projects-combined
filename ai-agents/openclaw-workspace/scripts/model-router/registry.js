// registry.js — Live model registry with health state
// Models are tried in priority order. Health scores are updated in real-time.

export const REGISTRY = [
  // ── PRIMARY — Local Ollama models only (no cloud, no costs) ────────────────
  {
    id: 'ollama:llama31-agent',
    type: 'ollama',
    model: 'llama31-agent:latest',
    endpoint: 'http://127.0.0.1:11434',
    priority: 1,
    contextWindow: 131072,
    healthy: true,
    failStreak: 0,
    avgLatency: 0,
    successRate: 1.0,
    lastCheck: null,
    lastError: null,
  },
  // ── FALLBACK — Gemma 4 (already downloaded) ───────────────────────────────
  {
    id: 'ollama:gemma4',
    type: 'ollama',
    model: 'GEMMA4:latest',
    endpoint: 'http://127.0.0.1:11434',
    priority: 2,
    contextWindow: 131072,
    healthy: true,
    failStreak: 0,
    avgLatency: 0,
    successRate: 1.0,
    lastCheck: null,
    lastError: null,
  },
];

// Scoring: higher = better. Used to sort when multiple models are healthy.
export function scoreModel(m) {
  if (!m.healthy) return -1;
  const latencyScore = m.avgLatency > 0 ? Math.max(0, 1 - m.avgLatency / 30000) : 0.5;
  const reliabilityScore = m.successRate;
  const failPenalty = m.failStreak * 0.15;
  return (reliabilityScore * 0.6) + (latencyScore * 0.4) - failPenalty;
}

export function getRanked() {
  return [...REGISTRY]
    .map(m => ({ ...m, score: scoreModel(m) }))
    .sort((a, b) => {
      // Healthy models first, then by score, then by priority
      if (a.healthy !== b.healthy) return b.healthy - a.healthy;
      if (Math.abs(a.score - b.score) > 0.05) return b.score - a.score;
      return a.priority - b.priority;
    });
}

export function recordSuccess(id, latencyMs) {
  const m = REGISTRY.find(x => x.id === id);
  if (!m) return;
  m.failStreak = 0;
  m.healthy = true;
  m.avgLatency = m.avgLatency === 0 ? latencyMs : Math.round(m.avgLatency * 0.8 + latencyMs * 0.2);
  m.successRate = Math.min(1.0, m.successRate * 0.95 + 0.05);
  m.lastCheck = new Date().toISOString();
  m.lastError = null;
}

export function recordFailure(id, error) {
  const m = REGISTRY.find(x => x.id === id);
  if (!m) return;
  m.failStreak += 1;
  m.successRate = Math.max(0, m.successRate * 0.9);
  m.lastCheck = new Date().toISOString();
  m.lastError = error?.message || String(error);
  if (m.failStreak >= 3) m.healthy = false;
}

export function resetIfRecoverable(id) {
  const m = REGISTRY.find(x => x.id === id);
  if (m && m.failStreak >= 3 && m.failStreak < 10) {
    // Allow retry after enough failures — it might recover
    m.healthy = true;
  }
}
