# MAX Capabilities — What Needs Setup to Unlock Full Power

## STATUS: What's Working vs. What Needs Action

---

## ✅ ALREADY WORKING
- Discord + Telegram messaging
- File read/write in workspace
- Unity batch mode (compile, scene build)
- FORGE 22 landing pages built
- CLAWED scene built (Assets/CLAWED/Scenes/PrisonLevel01.unity)
- OpenRouter llama-3.3-70b model (cloud, free, 131K context)
- Edge TTS voice (en-US-GuyNeural)

---

## 🔧 NEEDS CHROME EXTENSION — Browser Control (Account Creation)

**What it unlocks:** MAX can navigate websites, fill forms, create accounts, click buttons

**Setup (Lee does this once):**
1. Gateway is already running browser server at http://127.0.0.1:18791/
2. In terminal: `openclaw skills run browser-setup` OR manually:
   - Find extension at: `C:\Users\Gierl\.openclaw\browser\chrome-extension\`
   - Open Chrome → chrome://extensions → Enable "Developer mode"
   - Click "Load unpacked" → select that folder
   - Extension appears in toolbar → click it → enter gateway token
   - Token is in openclaw.json: `4503b9af0c6c27ff36bf4ef43dc3748bda660ccfec5aaacb`
3. Click the extension once on any tab → MAX can now see and control that tab

**What MAX can do after:**
- Navigate to fiverr.com, fill registration form, submit
- Navigate to upwork.com, create profile
- Navigate to itch.io, create account + upload CLAWED
- Fill any web form

**What MAX still cannot do:**
- Solve image CAPTCHAs (human needed)
- Receive SMS codes (human needed)

---

## 🔧 NEEDS API KEY — Stock Trading (Alpaca)

**What it unlocks:** MAX can buy/sell stocks, monitor portfolio, execute strategies

**Setup:**
1. Go to alpaca.markets → Create free account
2. Get Paper Trading API keys first (test with fake money)
3. Share keys with MAX via: `openclaw config set env.ALPACA_API_KEY <key>`
4. MAX uses `position-tracker` skill + bash commands to trade

**MAX can do after:**
- Market orders, limit orders
- Portfolio monitoring
- P&L tracking
- Automated strategies (e.g., buy on dip, sell at target)

---

## 🔧 NEEDS DECISION — itch.io CLAWED Upload

**Current state:** Scene is built at Assets/CLAWED/Scenes/PrisonLevel01.unity

**To export WebGL build:**
```bash
"Z:\Dev\UNITY\Unity Hub\6000.4.0f1\Editor\Unity.exe" \
  -batchmode -quit -nographics \
  -projectPath "Z:\Dev\UNITY\BETTERNOW" \
  -executeMethod UnityEditor.BuildPipeline.BuildPlayer \
  -buildTarget WebGL \
  -logFile "Z:\Dev\UNITY\BETTERNOW\Logs\webgl-build.log"
```

**OR** Lee opens Unity manually → File → Build Settings → WebGL → Build → Then MAX uploads via itch.io CLI or browser relay.

---

## 🔧 NEEDS DOMAINS — FORGE 22 Brands Deploy

**Current state:** 22 HTML pages built at Z:\Dev\FORGE\brands\landing-pages\

**To deploy:**
1. Buy domains (~$240 at Namecheap for all 22, or start with top 5 for $50)
2. Create Netlify account (free tier = multiple sites)
3. MAX deploys via: `netlify deploy --dir landing-pages/forge` etc.

Priority domains to buy first:
1. forgedev.app (~$12)
2. nexusdev.app (~$12)
3. axiomdev.app (~$12)
4. manifestdev.app (~$12)
5. catalystdev.app (~$12)

---

## 🔧 NEEDS ACCOUNTS — Freelance Bidding

**Current state:** Gig content written in PLATFORM_GIGS.md

**Lee creates accounts manually (5 min each):**
- fiverr.com
- upwork.com
- itch.io

**After creation:** MAX handles all bidding autonomously via `freelancer-bidder` skill

