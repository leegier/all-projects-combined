# Reddit Post — AI Prompt Pack Launch

## Target Subreddits (post to all 3, same day, slightly different titles)

1. r/gamedev (1.2M members) — best reach
2. r/Unity3D (350K members) — targeted Unity devs
3. r/unrealengine (290K members) — UE5 angle

---

## POST #1 — r/gamedev

**Title:**
I kept writing the same AI prompts for Unity/UE5 every week, so I collected the 25 best ones into a $0.99 pack

**Body:**
Every time I start a new game feature I'm typing roughly the same thing into Claude/ChatGPT:
"Write me a Unity C# inventory system that..." or "Fix this NullReferenceException..." 

The results vary wildly based on how you phrase it. After months of refining these, I compiled the 25 prompts that actually get production-ready results:

**What's in it:**
- 5 bug-fixing prompts (NullRef killer, compile error fixer, profiler interpreter)
- 8 gameplay system prompts (character controller, inventory, save/load, enemy AI, combat, state machine, camera)
- 4 level design prompts (procedural layout, spawn balancing, perf audit, hierarchy organizer)
- 4 code quality prompts (reviewer, XML doc generator, SOLID refactor, async converter)
- 4 shipping prompts (itch.io description writer, patch notes from git diff, bug report template)

All tested with Claude Sonnet and ChatGPT-4. Unity 6 + UE5 compatible.

$0.99 on Gumroad: [LINK]

Happy to share a free sample in the comments if anyone wants to try one before buying.

---

## POST #2 — r/Unity3D

**Title:**
25 copy-paste prompts that make Claude/ChatGPT actually write usable Unity C# ($0.99)

**Body:**
The problem with using AI for Unity: ask it to "write an inventory system" and you get code that doesn't compile, uses obsolete APIs, or ignores your project structure.

These 25 prompts are engineered to fix that. Each one includes:
- Specific component requirements (CharacterController vs Rigidbody, etc.)
- Namespace and naming conventions
- [SerializeField] patterns
- Error handling Unity expects

Covers: movement, inventory, save/load, guard AI, combat, camera, state machines, code review, itch.io listings.

$0.99 → [LINK]

---

## POST #3 — r/unrealengine

**Title:**
AI prompts specifically written for Unreal devs — Blueprint to C++, actor systems, UE5 patterns ($0.99)

**Body:**
Most AI prompt packs are generic. These have UE5-specific prompts:
- Blueprint → C++ migration (with UPROPERTY/UFUNCTION macros)
- Actor component architecture
- Modern C++ patterns for UE5.3+

Plus Unity-specific prompts if you're cross-platform.

25 prompts, $0.99 → [LINK]

---

## INSTRUCTIONS FOR MAX

When the Gumroad link is live:
1. Replace [LINK] in all three posts with actual Gumroad URL
2. Post r/gamedev first (most reach)
3. Wait 3-4 hours, then post r/Unity3D
4. Wait another 3-4 hours, then post r/unrealengine
5. Reply to every comment within 1 hour for first 24h (Reddit algo rewards engagement)
6. If any post gets 10+ upvotes, add a comment with a free sample prompt to boost it further

**Free sample to offer in comments:**
```
You are a Unity C# expert. Here is my error log:
[PASTE ERROR LOG]
Here is the relevant script:
[PASTE SCRIPT]
Find the root cause. Explain it in one sentence. Then give me the minimal fix — change only what's broken, don't refactor anything else. Show me exactly which lines change.
```
