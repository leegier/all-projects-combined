# Nyghtshade Hollow

A Unity 6 (6000.5.4f1) project — skeleton stage. Built from the ground up, no Unity Hub or Editor GUI involved.

## Project Structure

```
NyghtshadeHollow_Unity/
├── Assets/
│   ├── Scripts/
│   │   ├── Core/          # Game manager, event system, core singletons
│   │   ├── NPC/           # NPC behavior, AI, dialogue
│   │   ├── Interaction/   # Player interaction, pickups, triggers
│   │   ├── UI/            # HUD, menus, inventory screens
│   │   ├── Economy/       # Currency, shops, trading
│   │   └── SaveLoad/      # Save/load system, serialization
│   ├── Scenes/            # Unity scene files
│   ├── Prefabs/           # Reusable prefabs
│   └── Resources/         # Runtime-loadable assets
├── Packages/
│   └── manifest.json      # Package dependencies
├── ProjectSettings/
│   └── ProjectSettings.asset
└── README.md
```

## Packages

| Package | Version | Purpose |
|---|---|---|
| com.unity.render-pipelines.universal | 17.0.4 | URP rendering |
| com.unity.inputsystem | 1.13.1 | New Input System |
| com.unity.ai.navigation | 2.0.6 | NavMesh AI navigation |
| com.unity.textmeshpro | 3.0.7 | Rich text / UI text |
| com.unity.cinemachine | 3.1.3 | Camera system |

## Settings

- **Unity Version:** 6000.5.4f1
- **Render Pipeline:** Universal Render Pipeline (URP)
- **Input System:** Input System Package (New)
- **Active Input Handling:** Input System Package (New)
- **Company:** Nyghtshade Hollow
- **Product:** Nyghtshade Hollow

## Getting Started

1. Open this folder in Unity Hub or launch Unity 6000.5.4f1 directly.
2. Unity will detect the existing project structure and regenerate Library/, Logs/, etc.
3. All six script subdirectories and package dependencies are already wired up.

No game scripts have been written yet — this is the bare project skeleton.
