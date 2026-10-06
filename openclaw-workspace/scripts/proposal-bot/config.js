// config.js — Central configuration for proposal-bot
// Primary: Anthropic claude-sonnet-4-6 | Fallback: OpenRouter

export const CONFIG = {
  // Anthropic — primary LLM for all generation
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-oat01-REDACTED',
    model: 'claude-sonnet-4-6',
  },

  // Telegram — same bot as MAX uses
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '8612410913:AAFxCwAs3yUSHKSnhM7IDR3EcE33QWheIjI',
    // Lee's chat ID — bot will report there. If unknown, set via env var.
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },

  // Freelancer profile — used in proposal generation
  profile: {
    name: 'Lee Gierl',
    title: 'Full-Stack Developer | Unity | AI Automation',
    rate: 65, // USD/hr
    skills: [
      'React', 'Node.js', 'Python', 'TypeScript',
      'Unity (C#)', 'WebGL', 'REST APIs', 'PostgreSQL',
      'AI/ML integration', 'browser automation', 'Playwright',
    ],
    strengths: [
      'Ship fast, clean code — no bloat',
      '10+ years building production systems',
      'Autonomous AI tooling specialist',
      'Unity game dev with WebGL export experience',
    ],
    fiverr: {
      username: '',   // fill after account created
      sessionFile: './sessions/fiverr.json',
    },
    upwork: {
      username: '',   // fill after account created
      sessionFile: './sessions/upwork.json',
    },
  },

  // Job search filters
  search: {
    upwork: {
      keywords: [
        'react developer',
        'node.js developer',
        'unity developer',
        'python automation',
        'web scraping',
        'AI integration',
        'full stack developer',
      ],
      minBudget: 50,   // USD
      maxResults: 20,  // per run
    },
    fiverr: {
      buyerRequests: [
        'web development',
        'unity game',
        'automation script',
        'react app',
        'node.js',
      ],
    },
  },

  // Paths
  paths: {
    sessions: './sessions',
    proposals: './proposals',
    submitted: './submitted',
    logs: './logs',
  },

  // Rate limits — be a human
  delays: {
    betweenJobs: [2000, 5000],     // ms range (random)
    betweenActions: [800, 2000],   // ms range (random)
    afterSubmit: [5000, 12000],    // ms range (random)
  },

  // Max proposals per run to avoid flags
  maxProposalsPerRun: 5,
};

export function randomDelay(range) {
  const [min, max] = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
