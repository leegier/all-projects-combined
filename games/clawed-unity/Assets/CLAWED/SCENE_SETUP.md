# CLAWED — Scene Setup Guide

Open project: `Z:\Dev\UNITY\BETTERNOW` in Unity Hub (Unity 6000.4.0f1)

---

## Step 1: Use the Prison Demo Scene

1. Open: `Assets/Grim/LockDown Prison/Scenes/LockDown Demo.unity`
2. Save As: `Assets/CLAWED/Scenes/PrisonLevel01.unity`

This is your main game scene. It's pre-built with prison walls, cells, corridors, lights.

---

## Step 2: Create the Player

1. In Hierarchy → Create Empty → Name it `Player`
2. Tag it **Player**
3. Add Components:
   - `Character Controller` (Height 1.8, Radius 0.3)
   - `CLAWED.Player.PlayerSurvival`
   - `CLAWED.Player.PlayerController`
   - `CLAWED.Systems.InventorySystem`
   - `CLAWED.Systems.StealthSystem`
4. Add a child `GroundCheck` Empty at Y = -0.9, assign to PlayerController
5. Drag your camera as a child (or use Cinemachine)
6. Add a capsule or the Survivalist prefab as the visual mesh child

**Quick option:** Drag `Assets/ThirdPersonController/` prefab into scene, add your CLAWED scripts to it.

---

## Step 3: Create the Game Manager

1. Create Empty → Name `_GameManager`
2. Add `CLAWED.Core.GameManager`
3. Add `CLAWED.Systems.AlertSystem`

---

## Step 4: Set Up Guards

1. Drag `Assets/npc_casual_set_00/Prefabs/npc_csl_00_character_01f_01.prefab` into scene
2. Add `NavMeshAgent` component
3. Add `CLAWED.AI.GuardAI`
4. Create waypoint Empties around the prison corridor — assign to GuardAI.Waypoints[]
5. Set Layer masks:
   - PlayerLayer: `Player`
   - ObstacleLayer: `Default` (walls)
6. Bake NavMesh: Window → AI → Navigation → Bake

---

## Step 5: Interactables

**Food item:**
1. Create a prop (cube or drag from Assets/LoafbrrAssets/)
2. Add `CLAWED.Systems.InteractableObject`
3. Set: DropsItem=true, ItemType=Food, ItemValue=30, OneTimeUse=true

**Keycard:**
1. Same setup, ItemType=KeyCard, Name="Cell Key"

**Escape Door:**
1. Find a door prefab in `Assets/Grim/LockDown Prison/Prefabs/Doors and Gates/`
2. Add `CLAWED.Systems.PrisonDoor`
3. Tag it `EscapeDoor`
4. Set RequiredKeyCardName="Cell Key"

---

## Step 6: HUD

1. Create Canvas (Screen Space Overlay)
2. Add 4 Sliders (Health, Hunger, Thirst, Stamina)
3. Add TextMeshPro for Alert Label
4. Add Image panel for alert background
5. Create empty `_HUD` object, add `CLAWED.UI.HUDController`
6. Wire all references in Inspector

---

## Step 7: Audio

- `Assets/Horror Sfx/` — ambient atmosphere, jumpscare sounds
- `Assets/Footsteps - Essentials/` — player footsteps (add AudioSource to Player, trigger on step)
- `Assets/MaleCharVocSFXLITE/` — guard voice lines

---

## Step 8: Build & Ship

1. File → Build Settings → PC Standalone (Windows x64)
2. Build to `Builds/CLAWED_v0.1/`
3. Zip the build folder
4. Upload to itch.io (create page: `itch.io/games/clawed`)
5. Set price: $2.99 early access OR free + donations

---

## Core Loop (MVP)

- Player spawns in prison cell
- Must find keycard (hidden in guard room or locker)
- Avoid guards (stealth / distraction)
- Survive hunger/thirst (find food in cafeteria, water in bathroom)
- Unlock escape door → Win

**Target time to MVP: 3-5 days of focused work**
