/**
 * memory-consolidate.js
 * Runs nightly via Windows Scheduled Task.
 * Reads today's daily memory file and appends a dated summary marker to MEMORY.md
 * so MAX knows when memory was last consolidated.
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = 'C:\\Users\\Gierl\\.openclaw\\workspace';
const MEMORY_FILE = path.join(WORKSPACE, 'MEMORY.md');
const MEMORY_DIR = path.join(WORKSPACE, 'memory');

// Today's date
const today = new Date();
const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
const dailyFile = path.join(MEMORY_DIR, `${dateStr}.md`);

// Create today's daily memory file if it doesn't exist
if (!fs.existsSync(dailyFile)) {
  fs.writeFileSync(dailyFile, `# Memory Log — ${dateStr}\n\n_No entries yet today._\n`);
  console.log(`[memory] Created daily file: ${dailyFile}`);
}

// Update the "last consolidated" timestamp in MEMORY.md
let memory = fs.readFileSync(MEMORY_FILE, 'utf8');
const marker = `_Last auto-consolidated:`;
const newMarker = `_Last auto-consolidated: ${today.toISOString()} by memory-consolidate.js_`;

if (memory.includes(marker)) {
  memory = memory.replace(/_Last auto-consolidated:.*_/g, newMarker);
} else {
  memory += `\n\n---\n${newMarker}\n`;
}

fs.writeFileSync(MEMORY_FILE, memory);
console.log(`[memory] Updated MEMORY.md consolidation timestamp: ${dateStr}`);

// Clean up daily files older than 30 days
const files = fs.readdirSync(MEMORY_DIR);
const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
let cleaned = 0;
for (const f of files) {
  if (!/^\d{4}-\d{2}-\d{2}.*\.md$/.test(f)) continue;
  const filePath = path.join(MEMORY_DIR, f);
  const stat = fs.statSync(filePath);
  if (stat.mtimeMs < cutoff) {
    // Archive old daily files (don't delete — move to archive)
    const archiveDir = path.join(MEMORY_DIR, 'archive');
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);
    fs.renameSync(filePath, path.join(archiveDir, f));
    cleaned++;
  }
}
if (cleaned > 0) console.log(`[memory] Archived ${cleaned} old daily files`);

console.log('[memory] Done.');
