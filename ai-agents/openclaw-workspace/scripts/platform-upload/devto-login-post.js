import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiKeyPath = "Z:/openclaw/workspace/devto-api-key.txt";
const resultsPath = "Z:/openclaw/workspace/devto-posts.txt";

async function loginAndGetApiKey(page) {
  console.log("Logging in to dev.to...");
  await page.goto("https://dev.to/enter", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill("input[name=\"user[email]\"], #user_email, input[type=\"email\"]", "leegier6@gmail.com");
  await page.fill("input[name=\"user[password]\"], #user_password, input[type=\"password\"]", "Gameover2026!!");
  await page.screenshot({ path: "Z:/openclaw/workspace/devto-login-filled.png" });
  await page.click("button[type=\"submit\"], input[type=\"submit\"], button:has-text(\"Log in\"), button:has-text(\"Continue\")");
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "Z:/openclaw/workspace/devto-after-login.png" });
  console.log("After login:", page.url(), await page.title());

  await page.goto("https://dev.to/settings/extensions", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "Z:/openclaw/workspace/devto-extensions3.png" });
  console.log("Extensions:", page.url(), await page.title());

  const allInputs = await page.locator("input").all();
  console.log("Inputs on extensions page:", allInputs.length);
  for (let i = 0; i < allInputs.length; i++) {
    const ph = await allInputs[i].getAttribute("placeholder").catch(() => "");
    const id = await allInputs[i].getAttribute("id").catch(() => "");
    console.log("  input", i, "id:", id, "ph:", ph);
  }

  for (const descSel of ["#new-api-key-desc", "input[placeholder*=\"description\" i]", "input[placeholder*=\"Key\" i]", "input[name*=\"key\"]"]) {
    try {
      const el = page.locator(descSel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await el.fill("max-bot");
        console.log("Filled:", descSel);
        break;
      }
    } catch(e) {}
  }

  const btns = await page.locator("button").all();
  for (const btn of btns) {
    const txt = await btn.textContent().catch(() => "");
    if (txt && txt.toLowerCase().includes("generat")) {
      console.log("Clicking:", txt.trim());
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "Z:/openclaw/workspace/devto-generated.png" });

  for (const sel of ["input[readonly]", ".generated-api-key", "code", "pre"]) {
    try {
      const el = page.locator(sel).last();
      const val = await el.inputValue({ timeout: 1000 }).catch(() => el.textContent({ timeout: 1000 }));
      const clean = val && val.trim();
      if (clean && clean.length > 20 && /^[a-zA-Z0-9_-]+$/.test(clean)) {
        console.log("Got API key via", sel);
        writeFileSync(apiKeyPath, clean);
        return clean;
      }
    } catch(e) {}
  }
  return null;
}

async function postArticle(apiKey, article) {
  console.log("Posting:", article.title);
  const res = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({ article }),
  });
  const data = await res.json();
  console.log("Status:", res.status, data.url || JSON.stringify(data).substring(0, 300));
  return { status: res.status, data };
}
const a1 = readFileSync(path.join(__dirname, "article1.txt"), "utf8");
const a2 = readFileSync(path.join(__dirname, "article2.txt"), "utf8");
const a3 = readFileSync(path.join(__dirname, "article3.txt"), "utf8");

const articles = [
  { title: "I Spent One Week Building a Stealth Survival Game with Unity AI — Here's What Happened", tags: ["gamedev","unity","indiegames","csharp"], body_markdown: a1, published: true },
  { title: "50 Claude & ChatGPT Prompts That Actually Work in Production (Free Sample + Full Pack)", tags: ["ai","productivity","chatgpt","programming"], body_markdown: a2, published: true },
  { title: "I Launched My SaaS Product to 22 Different Audiences at Once Using HTML Templates", tags: ["webdev","saas","marketing","html"], body_markdown: a3, published: true },
];

async function main() {
  const browser = await chromium.launch({ executablePath: "C:/Users/Gierl/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const apiKey = await loginAndGetApiKey(page);
  await browser.close();
  if (!apiKey) { console.error("FAILED: no API key"); process.exit(1); }
  console.log("Got API key. Posting articles...");
  const results = [];
  for (const article of articles) {
    const result = await postArticle(apiKey, article);
    results.push({ title: article.title, ...result });
    await new Promise(r => setTimeout(r, 1500));
  }
  const lines = results.map(r => {
    const url = (r.data && (r.data.url || r.data.canonical_url)) || "ERROR: " + JSON.stringify(r.data).substring(0, 200);
    return "[" + r.status + "] " + r.title + "\n  URL: " + url;
  });
  const output = "=== DEV.TO POSTS ===\n" + lines.join("\n\n") + "\n\nPosted: " + new Date().toISOString();
  writeFileSync(resultsPath, output);
  console.log("\n=== FINAL RESULTS ===\n" + lines.join("\n\n"));
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });