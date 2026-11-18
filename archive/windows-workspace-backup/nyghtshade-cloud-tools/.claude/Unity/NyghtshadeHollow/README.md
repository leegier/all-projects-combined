# Nyghtshade Hollow — Fresh Unity 6 Project
Built: 2026-08-04

## Open This Project
1. Launch **Unity Hub**
2. Click **Add** → Browse to `F:\Unity\NyghtshadeHollow`
3. Open with **Unity 6000.5.4f1**
4. Wait for asset import (7 FBX modules + 1 blockout FBX = ~8,000 meshes)

## Folder Structure
```
Assets/
  Scenes/          — Game levels (.unity files)
  Scripts/         — C# game code
  Prefabs/         — Reusable game objects
  Materials/       — Unity materials
  Textures/        — Image assets
  Models/
    Modules/       — 7 individual prison pieces (bunk, door, wall, arch, desk, floor, railing)
    Prison/        — Full blockout (4,903 meshes in one FBX)
  Audio/           — Sound effects
  Resources/
    NPC_DIALOGUE_FULL.json      — 8 original NPCs
    NPC_DIALOGUE_REMAINING.json — 59 additional NPCs
    PRISON_DIALOGUE.json        — Prison-specific dialogue
    item_database.json          — 20 Victorian prison items
  Editor/          — Editor-only scripts
```

## Script Architecture
```
PlayerController.cs  → First-person movement + E-key interaction (10m raycast)
Interactable.cs      → Base class: OnInteract(), hover highlight, tooltip
DoorController.cs    → Inherits Interactable: smooth 90° rotation, creak audio
NPCDialogue.cs       → Trigger-based dialogue initiator
DialogueManager.cs   → Singleton UI: JSON parsing, typewriter effect, choices
GameManager.cs       → Singleton: day/night cycle, time tracking
InventorySystem.cs   → 12-slot inventory, ScriptableObject items
QuestSystem.cs       → Active/completed quest tracking, object completion
SaveSystem.cs        → BinaryFormatter save/load to persistentDataPath
```

## How To Build The Prison Scene
1. After FBX import completes, open `Assets/Models/Prison/VictorianPrison_BLOCKOUT.fbx`
2. In the Inspector, check "Read/Write Enabled" and "Generate Colliders"
3. Drag the FBX into the Hierarchy — all 4,903 meshes will appear
4. Select the top parent GameObject and position it at (0, 0, 0)
5. Add a **Box Collider** component to walls and floors
6. Drag `Assets/Models/Modules/SM_*` into the scene for individual pieces
7. Add `Interactable.cs` to any object that should be interactive
8. Add `DoorController.cs` to door meshes
9. Drag the `PlayerController` prefab into the scene as the player start
10. Save scene: `File → Save As → Assets/Scenes/PrisonLevel.unity`

## Dialogue Setup
1. Create Canvas → Panel → name it "DialoguePanel"
2. Add Text (UI) for NPC name, dialogue text, and 4 choice buttons
3. Attach `DialogueManager.cs` to the Canvas
4. Drag the DialoguePanel reference into `DialogueManager.dialoguePanel`
5. Add `NPCDialogue.cs` to NPC trigger colliders in the scene
6. Set each NPC's `npcId` to match the JSON canonId (e.g., "NP-C009")

## Build Settings
- File → Build Settings → Add Open Scenes
- Target Platform: Windows, Mac, Linux
- Player Settings → Company Name: Nyghtshade Interactive
- Product Name: Nyghtshade Hollow
