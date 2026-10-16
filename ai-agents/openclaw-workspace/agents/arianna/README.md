# ARIANNA — Coding Sub-Agent

**Model:** GPT-5.4
**Role:** All coding tasks in the empire route through Arianna
**Reports to:** Claude (COO)

## Usage

### CLI
```bash
node arianna.js "write a Node.js script that scrapes itch.io for my product stats"
node arianna.js "fix this Unity C# null reference error: [paste error]"
node arianna.js "build a Discord slash command that posts the daily brief"
```

### From another script
```javascript
const { arianna, ariannaWithLog } = require('./arianna');

// Simple call
const code = await arianna('Write a function that formats Discord messages');

// With logging (saves output to logs/)
const code = await ariannaWithLog('Build a REST API endpoint for tracking sales');
```

## What Arianna handles
- Node.js / JavaScript
- Python scripts and pipelines
- Unity C# (CLAWED / Nyghtshade Hollow)
- Unreal Engine 5
- Discord bots
- HTML/CSS/JS web tools
- REST API integrations
- Automation scripts

## Logs
All outputs saved to: `Z:\openclaw\workspace\agents\arianna\logs\`

## Status
- Model: gpt-5.4
- API Key: set via OPENAI_API_KEY env variable
- Ready: YES
