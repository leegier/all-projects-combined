===============================================================================
 NYGHTSHADE HOLLOW / CLAWED - COMPLETE GAME DESIGN BIBLE
 Compiled from all Google Drive backup files
 Date: 2026-03-30
===============================================================================

TABLE OF CONTENTS
1. Game Identity & Vision
2. Lore & Story
3. Physical Layout & Architecture
4. Character Roster
5. Core Gameplay Systems
6. Economy & Currency
7. Progression & Skill Systems
8. Visual Identity & Art Direction
9. Technical Pipeline & Tools
10. Asset Inventory
11. Monetization Strategy
12. The ROD / Founding Fleet System
13. "The Forge" AI Dev Tool Suite
14. File-by-File Breakdown

===============================================================================
1. GAME IDENTITY & VISION
===============================================================================

Name: The Nyghtshade Hollow (with the "y")
Alternate Title: CLAWED
Type: AAA Prison Megastructure RPG
Creator: Lee Gier (Zachary Binks / Maddox Callahan Thatcher)
Purpose: Lee's son Braxton's retirement fund
Ambition: "Better than GTA"
Location (Canon): 1900 W Sunshine St, Springfield, MO 65807

Core Fantasy: You run, survive, manipulate, and possibly escape the most
complex prison environment ever built, where almost every system is a tool
or weapon.

Tone: Brutal realism + psychological tension
- Escape plots
- Corrupt systems
- Religious overtones (chapel, baptismal tunnel)
- Long-term lifers and broken staff

Engines: Unreal Engine 5.5/5.7 (primary), Unity, Blender
Character Tool: DAZ Studio 4.24

===============================================================================
2. LORE & STORY
===============================================================================

ORIGIN:
- Originally a military base with tunnels built 1933-1947
- Converted to a prison later
- Contractor faked the tunnel seals (thin brick, few inches of concrete)
- Internal tunnel network stayed intact

THE GREAT ESCAPE (Canon Event):
- 33 inmates escape through the tunnels
- 180-mile radius lockdown ordered
- Public warned: "Do not pick up hitchhikers"
- Drives escape missions, rumors, staff coverups

KEY TUNNEL ACCESS:
- Under the chapel baptismal (never properly closed)
- Other unknown access points throughout the facility

===============================================================================
3. PHYSICAL LAYOUT & ARCHITECTURE
===============================================================================

OUTER PERIMETER:
- Entire complex inside an OCTAGONAL perimeter
- Three fences in a row following the octagon shape
- Central north-south fence line = "The Spine"

THE SPINE (Central Corridor):
- Admin / Warden tower
- Medical wing
- Intake / processing
- Visitation
- Central control / security hub
- Armory, staff services, records

HOUSING UNITS (West Side):
- 10 four-story housing units
- Each unit: X-shaped with 4 wings
- Center: One-story OCTAGONAL rotunda
- Single door entry to each rotunda
- Officer's desk at entry
- Stairs to basement (tunnels/utility) at back

WINGS & CELLS:
- 4 wings per unit, 4 floors per wing
- 150 cells per side (300 per wing total)
- Top walk / bottom walk arrangement
- 20-man shower & bathroom with sinks on bottom center

GYM COMPLEX:
- UFC-sized octagon ring (30ft diameter, "The Pit")
- Weight area (benches, squat racks, pull-up towers)
- Official Tattoo Shop
- Yard Tattoo Area (hidden)
- Cardio strip
- DC Betting Terminals

REC WING:
- Billiards Room (4 tables, bright lights)
- Ping Pong Room (2-3 tables)
- TV Room (multiple screens, individual viewing)
- Movie Theater (SAFE ZONE - giant projector, surround sound)

THE BARRIO (Commissary):
- Full inmate shopping district
- DC currency spending hub
- Clothes, food, luxuries, gray-zone items
- Dynamic pricing based on fights, contraband, crackdowns

CHAPEL: Absolute safe zone - NO fighting, violence, or cursing EVER

UNDERGROUND TUNNELS:
- Built 1933-1947 (military base era)
- Blackened concrete, moisture stains
- Blue utility lines, limited red (danger markers)
- Chapel baptismal entry point
- Connect to housing units, spine, utility areas

===============================================================================
4. CHARACTER ROSTER
===============================================================================

WARDEN VALENTINO ("Valley") - Active warden, runs the Hollow

BRIDGET GALLETTI - Nurse of Nyghtshade Hollow
  - Artistic: painted the gym mural
  - Replaces "Mariah Whited" in canon

MADDOX CALLAHAN THATCHER ("X") - Lee Geyer's updated name
  - Inmate who "runs shit in the yard"
  - Controls the Barrio economy
  - High-importance figure in inmate hierarchy

HARRINGTON MARLOWE - 85-year-old war vet lifer
  - Came back from war, found friend in bed with wife
  - Assaulted friend (friend died), wife fell down stairs (died)
  - Tragic, morally gray legacy prisoner

DAMIAN RADCLIFF - New NPC, role to be developed

REMOVED FROM CANON:
  - Arianna Geyer (was warden, now removed entirely)
  - Mariah Whited (name removed, role given to Bridget)

===============================================================================
5. CORE GAMEPLAY SYSTEMS
===============================================================================

PRISON LIFE SIMULATION:
- Count, chow, yard time, shower rotations
- Staff presence vs blind spots
- Full daily schedule system
- Clock-driven NPC behavior (already built in UE5)

FACTIONS & SOCIAL NETWORKS:
- 50+ gangs/factions defined (see Gang Catalog)
- Yard bosses, lifers, new fish, gang control
- Staff politics and corruption
- Progressive reputation system
- AI-driven NPC behaviors

COMBAT - THE OCTAGON:
- UFC-style fights all day every day
- Volunteer, forced, sponsored, or challenged
- Side betting (DC wagers)
- Fighter stats: record, stamina, reputation, injuries
- Streamed live to theater room

ESCAPE SYSTEM:
- Dynamic escape content: planning, recon, tool gathering
- Timing windows based on guard patterns
- Failure consequences: lockdown, punishment transfers
- Tunnel exploration and mapping

CRAFTING:
- Keys, shanks, lockpicks, burner plates
- Tattoo guns from electronics parts
- Wire stripping, battery tapping, hotwiring
- Skill-gated by library knowledge

TATTOO SYSTEM (Full Pipeline):
- Official Gym Shop: Pre-loaded designs, DC payment
- Yard Artists: Cheaper but risky, quality varies
- Housing Unit Sessions: All-night operations with lookouts
- Custom Upload: $5 real money per image
- Gang Tattoos: $5 each, give stackable perk points
- Tattoo Skill Tree: Science, Metalwork, Ink Chemistry, Art, Hygiene
- Infection/hygiene risk mechanics

RECREATION:
- Ping Pong: +Dexterity, hand-eye coordination
- Billiards: +Precision, patience, pattern recognition
- TV Room: Morale regen, information drip
- Theater: Influence XP, safe zone
- All rooms = BRIGHT LIGHTS always (no dim rooms)

STEALTH:
- Guard detection cones
- Point man lookout system for tattoo sessions
- CO patrol patterns
- Coded knock/cough signals

CORRUPTION SYSTEM:
- Some COs are crooked (canon)
- Can be bribed if artist has right perk level
- CO on payroll = higher prices but safer sessions
- Corruption progression mechanic

===============================================================================
6. ECONOMY & CURRENCY
===============================================================================

DC (Digital Credits / "Hollow Bucks"):
- Prison-wide cryptocurrency
- Earned: Fight wins, betting, smuggling, faction missions
- Spent: Commissary, services, tattoos, favors
- Real money purchase available for gang tattoos
- Dynamic pricing: fights, contraband, crackdowns affect costs
- Behavioral control: privileges revoked for bad behavior

The Barrio handles all official transactions
Faction bosses control DC flow
Staff corruption creates secondary economy

===============================================================================
7. PROGRESSION & SKILL SYSTEMS
===============================================================================

THREE PRIMARY BUILD PATHS:

1. THE FIGHTER
   - Heavy gym usage, octagon dominance
   - Stats: Strength, Stamina, Striking Power, Grappling
   - Controls yard operations

2. THE MANIPULATOR
   - Library psychology mastery
   - Stats: Charisma, Threat Efficiency, Negotiation
   - Turns factions against each other

3. THE TECHNICIAN
   - Science + metalwork focus
   - Stats: Crafting, Electronics, Engineering
   - Backbone of escape teams

LIBRARY SKILL TREES:
A. Manipulation/Psychology - Gaslighting, crowd influence, reading fear
B. Human Anatomy - Pressure points, critical damage multipliers
C. Metal & Stone Crafting - Keys, shanks, tools
D. Science & Electrical - Hotwiring, circuits, door hacking

GANG TATTOO PERK STACKING:
  1 tattoo:  +5% Intimidation, +2% Fear Aura
  5 tattoos: +20% Intimidation, +10% Fear Aura
  10 tattoos: +40% Intimidation, +20% Fear Aura
  20 tattoos: +75% Intimidation, +30% Fear Aura
  30+ tattoos: +100% Intimidation, +40% Fear Aura (Untouchable)
  STACKS INDEFINITELY

WORK CREWS (Stat Grind Zones):
- Maintenance: Engineering XP
- Kitchen: Manipulation & smuggling
- Tunnel cleanup: Escape intel
- Yard crew: Stamina, strength, intimidation
- Library clerks: Fast-reading, psychology, social influence

===============================================================================
8. VISUAL IDENTITY & ART DIRECTION
===============================================================================

PRIMARY COLORS:
- DEEPEST FLAT BLACK (walls, all surfaces, light-absorbing)
- CRIMSON RED (#8B0000 to #990000)

WALL SPEC (Every wall in the prison):
- Base: Deepest flat black
- THREE crimson stripes, each 1 FOOT WIDE:
  * Upper: 1 foot below ceiling
  * Middle: Waist/lower-belly height
  * Lower: 1 foot above floor

FLOOR SPEC:
- Black marble with crimson veining
- 1-foot-wide red perimeter stripe, 1 foot from every wall

METALWORK:
- ALL cell gates, doors, bars = same crimson red
- Railings, catwalks, panels = slate gray/gunmetal

LIGHTING:
- BRIGHT WHITE EVERYWHERE during normal operations
- ZERO dim rooms except:
  * LOCKDOWN mode: Red strip lights in hall centers
  * LIGHTS-OUT CURFEW: Four red ceiling lights dimly in dayrooms
- Medical: White lighting
- Security: Cold fluorescent blue
- Chapel: Dark wood, candlelight amber, red undertones at baptismal

ENGINE MATERIAL SPECS:
- UE5: BaseColor #000000, Stripes #8B0000-#990000, Roughness 0.8-1.0
- Unity HDRP: Smoothness 0-0.1, no metallic
- Blender: Principled BSDF, MixShader for stripe masks

===============================================================================
9. TECHNICAL PIPELINE & TOOLS
===============================================================================

ENGINES:
- Unreal Engine 5.5 / 5.7 (primary game engine)
- Unity (secondary/companion)
- Blender (procedural generation, asset prep)
- DAZ Studio 4.24 (character creation)

BRAXTIGCONFIG (AI Dev Assistant):
- Plugin that injects into UE5, Unity, and Blender
- Capabilities: Asset scanning, auto-tagging, prison assembly
- In-editor helper mode + external background mode
- PowerShell automation scripts

"THE FORGE" (Dev Tool Suite - from Gemini conversations):
- Universal Game Architect system
- Python orchestrator bridging AI to game engines
- Unity Bridge (ForgeBridge.cs with FileSystemWatcher)
- UE5 Bridge (BRAXTONCONFIG_Unreal_Bridge.cpp)
- Components: The_Library, The_Injectors, The_Boxx, Bridges

ALREADY BUILT IN UE5 (Verified Working):
- NH_GameState authoritative clock (ticking, broadcasting)
- UNH_ScheduleComponent reading DataTables
- Central ScheduleManager listening to OnMinuteChanged
- NPC -> Schedule -> Blackboard -> Behavior Tree flow
- TargetPoints driving movement
- Debug UI path
- Console time forcing
- Optional lockdown override
- Server-authoritative design
- InmateWallet C++ class
- Violation Dossier system
- JudicialSentencer class

UE5 BLUEPRINT OBJECTS PLANNED:
- BP_TattooStation, BP_YardTattooArtist
- BP_LightingController, BP_GangTatPurchaseTerminal
- BP_RecActivity (Pool, PingPong, TV, Theater)
- BP_PlayerStats, BP_CO_Bribeable
- BP_DC_Wallet, BP_CellTradeSystem
- BP_StealthDetection

GITHUB: leegier6@gmail.com repositories
- shiny-happiness (parent repo with submodules)
- OpenSourceLudus (AI copilot scripts)
- FRANKENSTINES-DEV-BOXX
- injectioncgpt55
- THENYGHTSHADEHOLLOW (main UE5 project)

PC SPECS (from forensic audit):
- CPU: AMD Ryzen 7 1700X
- GPU: AMD (specific model in system)
- User: FRANK
- Multiple drives: C:, D:, G:
- UE 5.3 and 5.4 installed
- Unity Hub with many versions
- Blender 5.0.0
- Visual Studio installed

===============================================================================
10. ASSET INVENTORY
===============================================================================

ASSET VAULT: D:\Nyghtshade_Assets_Vault\
Total Raw Assets: 2,551
Total Imported to Unreal: 0 (all still need import!)

KEY ASSET PACKS (790 FBX files cataloged):
- Grim LockDown Prison: 220+ models (cells, walls, gates, floors,
  bathroom tiles, canteen, desks, prison-specific props)
- BK_AlchemistHouse: Architecture, furniture, items, weapons
- Cozy Mountain Cabin, Wasteland Cabin, FurnishedCabin
- Prison Cell pack: Chains, doors, lattice, walls, torches
- NPC Casual Set: Male/female characters, clothing, hair
- UMA: Character generation system (male/female unified)
- VanillaLoopStudio Animations: Cover, locomotion, ladders, lifts,
  dodging, stairs, survival, storage interactions
- Survivalist: Military character, animations, environment
- Street Lights, Desks, Swimming Pool, Hangar
- IvyLite: Vegetation/foliage system
- Modular Catwalk, Brick Houses, Mines & Caves

AUDIO ASSETS:
- Blood & Gore: Dripping, punches, bone rips, stabs
- Character: Male/female efforts, gear, grabs, footsteps
- Surface sounds: Metal, rock, wood impacts/scrapes/steps
- Enemies: Monster & zombie (attacks, deaths, grunts)
- Environment: Doors, gates, birds, wind, bridges
- Music: Ambience, boss fight, music box, scary puzzle
- Menu sounds

STRAY ASSETS: FBX files found in UE 5.3 and 5.4 engine dirs
(these are engine-default files, not project assets)

===============================================================================
11. MONETIZATION STRATEGY
===============================================================================

FREE-TO-PLAY WITH MICROTRANSACTIONS:
- Gang Tattoos: $5 per tattoo (real money via Hollow Bucks)
  * Each gives stackable perk points (unlimited)
  * Pre-loaded OR custom upload = same price
- Custom Tattoo Upload: $5 per image
- Premium Ink Colors
- Premium Needle Frames
- Artist Shop Skins
- Seasonal/Limited Edition Tattoo Designs
- Profile Banners showing tattoo count
- 3D animation intros (tattoos during fights)

HOLLOW BUCKS (DC):
- Real money -> Hollow Bucks conversion
- Used for all premium purchases in-game
- Cannot bypass with in-game grinding for gang tattoos

===============================================================================
12. THE ROD / FOUNDING FLEET SYSTEM
===============================================================================

From Founding_Fleet_Decree.txt:

THE ROD: A distributed computing / "Angler" network
- Users download "Buddy Access" client
- Leave rig on for 24 hours of "Full Trawl" contribution
- System tracks GPU idle time for network pulls

FOUNDING FLEET (First 100 "Anglers"):
- Milestone: 24 hours of Full Access contribution
- Rewards:
  * Lifetime Game Pass (Nyghtshade Hollow + all updates, free forever)
  * 10,000 Architect Credits (AC)
  * "Monolithic" founder popup celebration

CODE EXISTS:
- Buddy_Service.pyw (Python idle monitor + trawl tracker)
- Founder_Popup.py (CustomTkinter celebration UI)
- BRAXTONCONFIG_Unreal_Bridge.cpp (UE5 C++ bridge)
- bootstrap_founding.py (deployment script)

The ROD includes:
- Adaptive throttling based on user activity
- angler_ledger.json for time tracking
- Grid network access system

===============================================================================
13. "THE FORGE" AI DEV TOOL SUITE
===============================================================================

From Gemini.txt conversations:

Unified AI-powered game development toolkit:
- Renamed from OMNICORE -> THE FORGE
- Python orchestrator (Forge_Core.py)
- Unity Bridge (ForgeBridge.cs) - FileSystemWatcher for real-time commands
- Unreal Bridge (C++ integration)
- Components:
  * The_Library (AI scripts, formerly OpenSourceLudus)
  * The_Injectors (live code injection, formerly injectioncgpt55)
  * The_Boxx (testing sandbox)
  * Bridges (Unity + Unreal plugins)

Planned capabilities:
- Plain-English game world generation
- Neural NPCs with goals and personalities
- Live code injection while game running
- Engine-agnostic (Unity + Unreal from single source)
- Dashboard UI with command terminal + visual node editor

Launch planned on Itch.io ($0 or donate, $15 suggested)

===============================================================================
14. FILE-BY-FILE BREAKDOWN
===============================================================================

blueprint4hollow.txt (296KB, 13,248 lines):
  THE MASTER GAME DESIGN DOCUMENT. Contains the entire ChatGPT conversation
  where Lee designed the game systems. Includes:
  - Complete prison layout and architecture
  - Character roster and backstories
  - Color scheme and wall specifications
  - Gym, octagon, tattoo shop, rec wing designs
  - DC economy and commissary (The Barrio)
  - Library skill trees and progression paths
  - Faction system (50+ gangs with tattoo catalog)
  - Tattoo system (official shop + yard artists + housing units)
  - Crafting recipes (tattoo guns, shanks, tools)
  - Infection/hygiene mechanics
  - CO bribery and corruption system
  - Lockdown lighting specifications
  - Monetization ($5 gang tattoos)
  - UE5 + Unity implementation blueprints
  - Stat tables and perk balancing

Founding_Fleet_Decree.txt (9KB):
  The "Founding Fleet" reward system for early supporters.
  Contains Python code for the Buddy Service (idle GPU monitor),
  Founder Popup UI, UE5 C++ bridge, and bootstrap deployment.
  First 100 users get lifetime game pass + 10,000 AC.

Gemini.txt (1.0MB, 45,082 lines):
  Massive Google Gemini AI conversation covering:
  - "The Forge" AI dev tool suite design
  - GitHub repo architecture analysis (shiny-happiness)
  - Unity Bridge C# code (ForgeBridge.cs)
  - Forge_Core.py master script
  - Itch.io launch strategy
  - Social media templates
  - ROD distributed computing system
  - Multiple ChatGPT prompt sequences for Codex/VS Code/UE5
  - NPC schedule system debugging (already working!)
  - Asset import automation scripts

VAULT_MAP.txt (368KB):
  Complete inventory of ALL files in D:\Nyghtshade_Assets_Vault.
  Lists every FBX, PNG, WAV, EXR file with full paths.
  Includes 3D models, textures, audio, lightmaps, animations.
  Major packs: LockDown Prison, AlchemistHouse, Cabin sets,
  NPC characters, UMA system, VanillaLoop animations.

FBX_ONLY.txt (65KB, 790 lines):
  Filtered list of ONLY .fbx 3D model files from the vault.
  790 models total across all asset packs.
  Key prison models in Grim\LockDown Prison\ folder.

STRAY_ASSET_REPORT.txt (18KB):
  Audit of FBX files found OUTSIDE the vault.
  Most are UE 5.3/5.4 engine-default files (not project assets).
  Useful for identifying what's engine-bundled vs custom.

VAULT_VS_ENGINE_INTEGRITY.txt (58KB, 2,559 lines):
  Integrity report: 2,551 raw vault assets, 0 imported to Unreal.
  Complete checklist of every asset needing import.
  ALL assets are still waiting to be brought into the engine.

PC_FORENSIC_MASTER_LIST.txt (14KB):
  Full PC filesystem audit. Shows:
  - Multi-drive setup (C:, D:, G:)
  - User: FRANK
  - Unity Hub with ~20 partial downloads
  - Blender temp files
  - Visual Studio, VS Code, Python installed
  - AMD GPU drivers

ALLCHATSCHATGPTINONE.txt (3.7MB, 111,205 lines):
  Massive combined ChatGPT conversation dump.
  Starts with AMD Threadripper case study (research material).
  Contains the full history of game development discussions.
  Overlaps significantly with blueprint4hollow.txt content.

chatgpt2.txt (1.3MB), gpt3.txt (2.4MB), gpt4.txt (2.0MB), gpt6.txt (760KB):
  Additional ChatGPT conversation segments.
  Contain various development discussions, code generation,
  troubleshooting, and design iterations.

DUPLICATE_CLEANUP_LOG.txt (5.8MB):
  Log of duplicate file cleanup operations on the PC.
  Shows massive deduplication effort across drives.

Skip_to_content.txt (4.5MB):
  Another large ChatGPT conversation dump.
  Contains overlapping content with other chat files.

===============================================================================
END OF SUMMARY
===============================================================================

CRITICAL NEXT STEPS FOR BUILDING THE GAME:
1. Import the 2,551 assets from the vault into UE5
2. The core NPC schedule system ALREADY WORKS in UE5
3. Build the prison layout (octagonal perimeter, 10 housing units, spine)
4. Apply the black+crimson material system
5. Implement the DC economy and Barrio
6. Build the octagon fight system
7. Implement the tattoo pipeline
8. Create the 50+ faction system
9. Build the tunnel network for escape gameplay
10. Deploy "The Forge" AI tools for accelerated development
