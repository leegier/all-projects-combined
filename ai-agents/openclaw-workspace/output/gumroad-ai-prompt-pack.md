# Gumroad Product — AI Game Dev Prompt Pack

## Product Details

**Title:** AI Game Dev Prompt Pack — 25 Power Prompts for Unity & UE5 Devs
**Price:** $0.99
**Format:** PDF (or Markdown → PDF via pandoc)
**Platform:** Gumroad (account: maxgier2026@gmail.com)

---

## Gumroad Listing Copy

### Product Title
AI Game Dev Prompt Pack: 25 Copy-Paste Prompts for Unity & Unreal Devs

### Short Description (shown in search)
Stop wasting time explaining your project to AI. These 25 tested prompts get Claude, ChatGPT, and Copilot to write production-ready game code, fix bugs, and design systems — instantly.

### Full Description

**The problem:** You ask AI to help with your game. It gives you generic, broken code that doesn't fit your project.

**The fix:** These 25 battle-tested prompts are engineered to get working results — not boilerplate.

---

**What's inside:**

🔧 **Bug Fixing (5 prompts)**
- "Here's my Unity error log. Find the root cause and fix it without changing anything else: [PASTE LOG]"
- NullReferenceException killer prompt
- Missing component auto-detective prompt

🎮 **Gameplay Systems (8 prompts)**
- Third-person character controller (Unity Input System)
- Inventory system with hotbar
- Save/Load system (JSON + PlayerPrefs)
- Enemy patrol AI with NavMesh
- Combat system with hitboxes
- UE5 Blueprint → C++ migration prompt
- State machine generator
- Camera system with wall avoidance

🎨 **Level Design & Scene (4 prompts)**
- Procedural room layout generator
- Enemy spawn balancing calculator
- Performance optimization audit prompt
- Scene hierarchy organizer

✍️ **Code Quality (4 prompts)**
- "Review this script for bugs, performance issues, and Unity best practices"
- Comment generator (adds XML docs to any script)
- Refactor for SOLID principles
- Convert coroutines to async/await

🚀 **Shipping (4 prompts)**
- itch.io product description writer
- Steam store page generator
- Patch notes writer from git diff
- Bug report template for players

---

**Works with:** ChatGPT, Claude, GitHub Copilot, Gemini
**Game engines:** Unity (2022 LTS, Unity 6), Unreal Engine 5

**Format:** PDF, instant download

---

### Price: $0.99

### Tags
unity, unreal engine, game development, AI prompts, ChatGPT, Claude, game dev tools, indie game, Unity C#

---

## THE ACTUAL PRODUCT — 25 PROMPTS

### SECTION 1: BUG FIXING

**Prompt 1 — Error Log Analyzer**
```
You are a Unity C# expert. Here is my error log:

[PASTE ERROR LOG]

Here is the relevant script:

[PASTE SCRIPT]

Find the root cause. Explain it in one sentence. Then give me the minimal fix — change only what's broken, don't refactor anything else. Show me exactly which lines change.
```

**Prompt 2 — NullReferenceException Hunter**
```
I'm getting a NullReferenceException in Unity at runtime. Here's the stack trace:

[PASTE STACK TRACE]

And here's the script mentioned in the trace:

[PASTE SCRIPT]

Identify exactly which variable is null and why. Give me the fix AND explain how to prevent this pattern in the future.
```

**Prompt 3 — Compile Error Fixer**
```
Unity won't compile. Here are all my CS errors:

[PASTE ALL ERRORS]

Fix them all. List each error, explain what caused it in plain English, and show the corrected line. Prioritize: fix errors that are causing other errors first.
```

**Prompt 4 — Performance Profiler Interpreter**
```
My Unity game is dropping frames. Here's my Profiler output:

[PASTE PROFILER DATA OR SCREENSHOT DESCRIPTION]

Identify the top 3 performance bottlenecks. For each: what it is, why it's expensive, and how to fix it. Give me code if the fix requires code changes.
```

**Prompt 5 — Missing Reference Detector**
```
My Unity script has serialized fields that are showing as None/Missing in the Inspector. Script:

[PASTE SCRIPT]

Tell me: (1) which fields need to be assigned, (2) what type of component/asset to assign, (3) whether they should be assigned in Inspector or via GetComponent() at runtime, and why.
```

---

### SECTION 2: GAMEPLAY SYSTEMS

**Prompt 6 — Third-Person Character Controller**
```
Write a Unity C# third-person character controller using the new Input System package.

Requirements:
- WASD/left stick movement relative to camera direction
- Shift to sprint (drains stamina float)
- Space to jump (only when grounded)
- C to toggle crouch (reduces collider height by 50%)
- Uses CharacterController component (not Rigidbody)
- GroundCheck using Physics.CheckSphere
- Smooth rotation toward movement direction
- [ADD YOUR PROJECT-SPECIFIC REQUIREMENTS HERE]

Write clean, commented C# with [RequireComponent] attributes. Use a nested [System.Serializable] Settings class for all tunable values.
```

**Prompt 7 — Inventory System**
```
Write a Unity C# inventory system.

Requirements:
- ItemData ScriptableObject: name, icon Sprite, type enum (Consumable/KeyItem/Weapon), stackable bool, maxStack int
- InventorySystem MonoBehaviour: List<ItemSlot> slots, max capacity, AddItem/RemoveItem/HasItem methods
- ItemSlot struct: ItemData item, int quantity
- InteractableObject MonoBehaviour: OnInteract() adds item to player inventory
- UI: simple HUD showing item names (Canvas + Text, no fancy UI needed)
- Singleton pattern for InventorySystem

Namespace: [YOUR_PROJECT_NAME].Systems
```

**Prompt 8 — Save/Load System**
```
Write a Unity C# save/load system using JSON.

Requirements:
- SaveData [Serializable] class: player position (Vector3), health (float), inventory item IDs (string[]), completed objectives (bool[])
- SaveSystem static class with Save(SaveData data) and Load() → SaveData methods
- Save path: Application.persistentDataPath + "/save.json"
- Graceful handling: if no save file exists, return default SaveData
- Include DeleteSave() method
- Add debug logging with [SAVE] prefix

No third-party libraries. Plain JsonUtility only.
```

**Prompt 9 — Enemy Patrol AI**
```
Write a Unity C# enemy AI that patrols waypoints and detects the player.

Requirements:
- Uses NavMeshAgent for movement
- States: Patrol → Alert → Chase → Attack → ReturnToPatrol
- Patrol: cycle through Transform[] waypoints array, wait X seconds at each
- Detection: Physics.CheckSphere for proximity + linecast for line-of-sight
- Alert: stop, play alert animation trigger, wait 1s, then Chase
- Chase: follow player NavMesh target
- Attack: stop at attackRange, call TakeDamage on player, cooldown
- ReturnToPatrol: if player lost for 5s, return to last waypoint
- All ranges/speeds/timers exposed as [SerializeField] floats

Script name: GuardAI.cs — namespace: [YOUR_NAMESPACE].AI
```

**Prompt 10 — Combat System**
```
Write a Unity C# combat system with hitbox-based damage.

Requirements:
- Health component: float currentHP, float maxHP, TakeDamage(float amount), OnDeath event
- Attack component: trigger collider activates during animation window only, OnTriggerEnter checks for Health component, applies damage
- Animation-driven: use Animation Events to enable/disable the hitbox collider
- DamageNumber: instantiate floating text prefab at hit position showing damage value
- Death: disable components, play death animation, destroy after 2s

Works for both player and enemies. No hardcoded layer checks — use LayerMask field.
```

**Prompt 11 — UE5 Blueprint to C++ Migration**
```
I have a Blueprint in Unreal Engine 5 that I want to convert to C++.

Here's what the Blueprint does (describe it):
[DESCRIBE YOUR BLUEPRINT LOGIC]

Write the equivalent C++ code as a UCLASS. Include:
- Proper header (.h) and implementation (.cpp) files
- All UPROPERTY() and UFUNCTION() macros needed
- BeginPlay() and Tick() if used in Blueprint
- Comments explaining each section
- Any includes needed

Target: UE5.3+, use modern C++ practices.
```

**Prompt 12 — State Machine Generator**
```
Write a Unity C# generic state machine for [ENEMY/PLAYER/NPC].

Requirements:
- IState interface: Enter(), Update(), Exit()
- StateMachine class: currentState, ChangeState(IState newState), Update()
- Concrete states for: [LIST YOUR STATES, e.g. IdleState, PatrolState, ChaseState]
- Each state has reference to owner via constructor
- No string-based state switching — use direct state object references

Write all classes. Show me how to initialize and use it in the owner MonoBehaviour.
```

**Prompt 13 — Third-Person Camera**
```
Write a Unity C# third-person camera controller.

Requirements:
- Attach to Camera GameObject, Target = player Transform
- Mouse X = horizontal orbit (yaw), Mouse Y = vertical orbit (pitch)
- Pitch clamp: -20 to 60 degrees
- Offset from target: (0, 1.8, -4) default, exposed as [SerializeField]
- Wall collision: SphereCast from target to desired camera position, pull camera in if blocked
- Cursor locked in game, unlocked on pause
- Smooth follow using Vector3.Lerp

No Cinemachine. Pure C#.
```

---

### SECTION 3: LEVEL DESIGN & SCENE

**Prompt 14 — Procedural Room Layout**
```
Write a Unity C# editor script that generates a simple grid-based dungeon layout.

Requirements:
- Grid size: configurable width × height (default 10×10)
- Room types: enum (Empty, Room, Corridor, Start, Exit)
- Algorithm: random walk from center, place rooms, connect with corridors
- Output: 2D int array representing the grid
- Visualization: draw gizmos in Scene view showing room types as colored squares
- MenuItem: "Tools/Generate Dungeon" 

C# editor script, runs in Editor only (#if UNITY_EDITOR).
```

**Prompt 15 — Enemy Spawn Balancer**
```
I'm designing enemy spawning for my [GAME TYPE] game. Here's my current setup:

- Player health: [X]
- Player DPS: [X]  
- Encounter duration target: [X] seconds
- Enemy types: [LIST ENEMIES WITH HEALTH AND DAMAGE]

Calculate:
1. How many of each enemy type to spawn for a fair fight
2. A "difficulty score" formula I can use to scale encounters
3. Spawn timing suggestions (all at once vs. waves)

Show your math. I want to understand the formula so I can adjust it myself.
```

**Prompt 16 — Performance Optimization Audit**
```
Audit this Unity C# script for performance issues:

[PASTE SCRIPT]

Check for:
- GameObject.Find() or FindObjectOfType() in Update()
- GetComponent() calls that should be cached
- String concatenation in hot paths
- Unnecessary new() allocations per frame
- Missing [SerializeField] on Inspector references
- Update() doing work that could be in a coroutine or event

For each issue found: show the bad code, explain why it's slow, show the fix.
```

**Prompt 17 — Scene Hierarchy Organizer**
```
I want to reorganize my Unity scene hierarchy. Here are my current objects:

[PASTE YOUR HIERARCHY - just the names]

Suggest a clean hierarchy structure using empty parent GameObjects as folders. Rules:
- Group by function (Environment, Characters, UI, Lighting, Managers, VFX)
- Name managers with underscore prefix (_GameManager, _AudioManager)
- Separate static from dynamic objects
- Keep it flat enough that nothing is more than 3 levels deep

Give me the full suggested hierarchy as an indented list.
```

---

### SECTION 4: CODE QUALITY

**Prompt 18 — Code Reviewer**
```
Review this Unity C# script as a senior game developer:

[PASTE SCRIPT]

Check for:
1. Bugs or logic errors
2. Performance issues (Update loops, allocations, GetComponent calls)
3. Unity best practices violations
4. Naming convention issues
5. Missing null checks
6. Thread safety issues

Format: for each issue, show the line, explain the problem, give the fix. Rate overall code quality 1-10 and explain why.
```

**Prompt 19 — XML Doc Comment Generator**
```
Add XML documentation comments to this Unity C# script. 

[PASTE SCRIPT]

For every public method, property, and field add:
- <summary> describing what it does
- <param> for each parameter  
- <returns> if it returns something
- <remarks> for any non-obvious behavior

Keep comments accurate and concise — one sentence per summary. Don't state the obvious.
```

**Prompt 20 — SOLID Refactor**
```
Refactor this Unity C# script to follow SOLID principles:

[PASTE SCRIPT]

Specifically:
- Single Responsibility: split if this class does more than one thing
- Open/Closed: use interfaces or abstract classes where behavior should be extensible
- Dependency Injection: replace direct GetComponent calls with injected dependencies where appropriate

Show me: (1) what violated SOLID and why, (2) the refactored code, (3) how to wire it up in the Inspector.
```

**Prompt 21 — Async Converter**
```
Convert these Unity C# coroutines to async/await:

[PASTE COROUTINES]

Requirements:
- Use UniTask if available, otherwise System.Threading.Tasks
- Preserve all timing behavior (WaitForSeconds → await UniTask.Delay)
- Handle cancellation with CancellationToken
- Wrap MonoBehaviour entry points with .Forget() or async void
- Add try/catch for OperationCanceledException

Show both the original and converted version side by side.
```

---

### SECTION 5: SHIPPING

**Prompt 22 — itch.io Product Description Writer**
```
Write an itch.io game page description for my game:

Name: [GAME NAME]
Genre: [GENRE]
Core mechanic: [WHAT THE PLAYER DOES]
Unique feature: [WHAT MAKES IT DIFFERENT]
Tone: [DARK/FUNNY/CHILL/etc.]
Platform: [PC/BROWSER/MOBILE]
Price: [FREE/PAID]

Write:
1. Short description (140 chars max — shown in search)
2. Full description (300-500 words, use itch.io HTML formatting)
3. 5 tags to maximize discoverability

Make it sound interesting, not like a press release.
```

**Prompt 23 — Steam Store Page Generator**
```
Write Steam store page copy for my game:

[SAME INPUT AS PROMPT 22, PLUS:]
- Target audience: [WHO IS THIS FOR]
- Comparable games: [2-3 games yours is similar to]
- Key features: [LIST 5 BULLET POINTS]

Write:
1. Short description (300 chars)
2. Long description (full HTML, ~600 words)
3. Feature bullet list (5 items, bold + description format)
4. Tags suggestions (15 tags)
```

**Prompt 24 — Patch Notes Writer**
```
Write patch notes for my game update.

Here are the git commits since last release:
[PASTE GIT LOG --oneline]

Or here's what changed (plain English):
[DESCRIBE CHANGES]

Write patch notes in this format:
- Version number: [I'LL FILL IN]
- Tone: [CASUAL/PROFESSIONAL]
- Sections: New Features, Changes, Bug Fixes, Known Issues
- Length: short (players skim patch notes)

Make it sound like a real developer wrote it, not a robot.
```

**Prompt 25 — Player Bug Report Template**
```
Create a bug report template for players of my [GENRE] game.

The template should collect:
- What they were doing when it happened
- What they expected vs. what happened
- How to reproduce it
- System info (OS, GPU, RAM)
- Game version
- Screenshot/video link (optional)

Format it as a simple form players can fill out in Discord or email. Keep it short — players won't fill out a 20-field form. Max 8 fields.
```

---

## GUMROAD PRODUCT SETUP INSTRUCTIONS

1. Go to https://app.gumroad.com/products/new
2. Product type: **Digital product**
3. Name: `AI Game Dev Prompt Pack: 25 Power Prompts for Unity & Unreal Devs`
4. Price: **$0.99** (suggested: $0+, so buyers can pay more)
5. File to upload: Export this document as PDF (or use `pandoc gumroad-ai-prompt-pack.md -o ai-prompt-pack.pdf`)
6. Cover image: Dark background, "25 AI PROMPTS" in bold white text, Unity/Unreal logos
7. Summary: *Stop writing bad AI prompts. These 25 tested prompts get Claude, ChatGPT, and Copilot to write production-ready Unity and UE5 code.*
8. Tags: unity, unreal, game dev, AI, ChatGPT, Claude, prompts, C#, game programming
9. Publish immediately

**Expected:** First sale possible within 24-48h of listing if posted to r/gamedev or r/Unity3D
