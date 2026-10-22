# CLAWED — Build Status

Last updated: 2026-03-26

## Current Build: v0.1 (Early Access)

| Step | Status |
|------|--------|
| Core scripts | ✅ Done |
| Scene built (PrisonLevel01) | ✅ Done |
| NavMesh baked | ✅ Done (batch mode) |
| PlayerAnimator | ✅ Done |
| AudioManager | ✅ Done |
| CameraController | ✅ Done |
| SaveSystem | ✅ Done |
| Windows build | ✅ Done (281 MB) |
| Zip for itch.io | ✅ Done (104 MB) |
| itch.io page | ⏳ Pending — account needed |
| itch.io upload | ⏳ Pending — account needed |

## Build Output
- Exe: `Builds/CLAWED_v0.1/CLAWED.exe`
- Zip: `Builds/CLAWED_v0.1.zip` (104 MB — ready to upload)

## What's Missing for Full Gameplay
- HUD wiring (Canvas + Sliders in Inspector — must be done manually in Unity Editor)
- Animation clips assigned to Player Animator Controller
- Audio clips wired to AudioManager in Inspector
- NavMesh walkable surfaces (currently uses default geometry — baked on LockDown Prison scene)

## Next Steps for Lee
1. **Register itch.io account** (THE_FORGE_IDE_GAMEDEV) → https://itch.io/register
2. Create new project: CLAWED — A Prison Survival Game
3. Upload `Builds/CLAWED_v0.1.zip`
4. Set price: $2.99 (or free + pay what you want)
5. Tags: survival, stealth, prison, horror, indie

## Git Log
```
63685d6 feat(CLAWED): add CLAWEDNavMeshBaker + BuildPipeline
1838c7e feat(CLAWED): add PlayerAnimator, AudioManager, CameraController, SaveSystem
e8f5d4b Add auto scene builder editor script
e4f895b Initial CLAWED commit: core game scripts + project rename
```
