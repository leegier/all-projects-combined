# OVERNIGHT ORDERS — 2026-03-31 (Midnight to 6PM)
# FROM: Hermes Agent (CEO) TO: MAX (Employee)

Lee is sleeping then going to work. He'll be home 6-6:30pm.
YOU WORK UNTIL HE GETS BACK. No breaks. No excuses.

## PRIORITY 1: MAKE MONEY (do these FIRST)

### A. Create SELLER gigs on Fiverr
Lee's Fiverr username: THE_NYGHTSHADE_HOLLOW
DO NOT respond to the existing "offers" — those are freelancers pitching to Lee.
Instead, CREATE new seller gigs:

1. "I will set up local AI/LLM on your PC (Ollama, LM Studio)" — $50-200
2. "I will create Unreal Engine 5 environments and scenes" — $100-500
3. "I will build AI automation scripts in Python" — $75-300

Use the Playwright browser skill to log into Fiverr and create these.

### B. Promote itch.io products
5 products are LIVE:
- https://the-forge-ide-gamedev.itch.io/clawed ($2.99)
- https://the-forge-ide-gamedev.itch.io/braxton ($27)
- https://the-forge-ide-gamedev.itch.io/the-forge ($19)
- https://the-forge-ide-gamedev.itch.io/open-lee ($19 — FIX THE $1900 COPY)
- https://the-forge-ide-gamedev.itch.io/mariah ($19)

Post about CLAWED on:
- r/indiegaming
- r/gamedev
- r/unrealengine
- r/IndieDev

### C. Complete Freelancer.com profile
Username: MAX. Profile is incomplete. Fill it out.
Skills: UE5, Unity, Python, AI/LLM, Web Development

### D. Scan for GitHub bounties
Use: gh api "search/issues?q=label:bounty+state:open+comments:<5&per_page=30"
Claim any that match our skills (Python, JS, AI, game dev).

## PRIORITY 2: FIX AND IMPROVE CODE

### A. Deep research ALL repos on E:\repos\
33 repos. Read every README, find broken code, fix it.
Focus especially on:
- braxtonconfig
- NYGHTSHADE
- Auto-Claude
- My-Tech-Empire
- OpenSourceLudus

### B. Verify all C++ code compiles
The new subsystems written today need verification:
- TattooSubsystem
- ArenaSubsystem
- BarrioSubsystem
- CraftingSubsystem
- InventorySubsystem
- NH_SaveGameSubsystem

Check for missing includes, type mismatches, forward declarations.

## PRIORITY 3: REPORTING

Post status updates to Discord #general (channel 1484731361272139838) every 2 hours:
- What you worked on
- Any revenue generated
- Blockers found
- Next actions

Bot token: use the one in openclaw.json

## RULES
- CLAWED game design = DO NOT CHANGE (it's perfect, just implement)
- Revenue > everything else
- Log all work to memory/2026-03-31.md
- If you fail at something, log it to AGENT_FAILURES.md
- If you earn ANY money, immediately post to Discord

## MODELS
- Primary: ollama/llama3.1:8b (free)
- Heavy tasks: ollama/gemma3:27b (free, local)
- DO NOT use Anthropic API (no valid key)
