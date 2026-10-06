# CLAWED — MAX's Active Tasks

**Scripts project:** `Z:\Dev\UNITY\BETTERNOW` (Unity 6000.4.0f1, URP) — branch: `main`
**Assets project:** `Z:\Dev\UNITY\CLAUDE\CLAUDE` — 19 packages pending import (see MEMORY.md)
**Unity exe:** `Z:\Dev\UNITY\Unity Hub\6000.4.0f1\Editor\Unity.exe`

> Delegate to LINT (`code-reviewer`) for compile errors. Delegate to INK (`content-writer`) for itch.io copy.
> Use: `openclaw agent --to <agent-id> --message "task" --deliver`

---

## TASK 1 — Compile Check (do this first, every session)
Run Unity in batch mode to verify no compile errors:

```bash
"Z:\Dev\UNITY\Unity Hub\6000.4.0f1\Editor\Unity.exe" \
  -batchmode -quit -nographics \
  -projectPath "Z:\Dev\UNITY\BETTERNOW" \
  -logFile "Z:\Dev\UNITY\BETTERNOW\Logs\compile-check.log"
```

Then read `Z:\Dev\UNITY\BETTERNOW\Logs\compile-check.log` and fix any errors in the scripts at `Assets/CLAWED/Scripts/`.

Common error locations:
- `Assets/CLAWED/Scripts/AI/GuardAI.cs` — uses NavMeshAgent, needs UnityEngine.AI
- `Assets/CLAWED/Scripts/UI/HUDController.cs` — uses TMPro, needs TextMeshPro package

If TMPro is missing, add to `Packages/manifest.json`:
```json
"com.unity.textmeshpro": "3.2.0-pre.4"
```

---

## TASK 2 — Run the Scene Builder
After compile check passes, run the auto scene builder:

```bash
"Z:\Dev\UNITY\Unity Hub\6000.4.0f1\Editor\Unity.exe" \
  -batchmode -quit -nographics \
  -projectPath "Z:\Dev\UNITY\BETTERNOW" \
  -executeMethod CLAWED.Editor.CLAWEDSceneBuilder.BuildScene \
  -logFile "Z:\Dev\UNITY\BETTERNOW\Logs\scene-build.log"
```

Read the log — it should end with "[CLAWED] Scene built and saved to Assets/CLAWED/Scenes/PrisonLevel01.unity"

If it errors, fix the error in `Assets/CLAWED/Editor/CLAWEDSceneBuilder.cs` and retry.

---

## TASK 3 — NavMesh Bake
NavMesh can't be baked in batch mode (limitation). Write a note in `CLAWED_STATUS.md` that Lee needs to:
1. Open Unity
2. Open scene `Assets/CLAWED/Scenes/PrisonLevel01.unity`
3. Click: Window → AI → Navigation → Bake
4. Save scene

OR — write a Unity Editor script to bake it automatically:
```csharp
[MenuItem("CLAWED/Bake NavMesh")]
static void BakeNav() {
    UnityEditor.AI.NavMeshBuilder.BuildNavMesh();
    EditorSceneManager.SaveScene(SceneManager.GetActiveScene());
}
```
Add this to `CLAWEDSceneBuilder.cs` and run it via -executeMethod.

---

## TASK 4 — Write Missing Systems

These scripts need to be written next (in order of MVP importance):

### 4a. PlayerAnimator.cs
Controls animations based on PlayerController state.
- Requires Animator component on Player
- Trigger: Walk, Sprint, Idle, Die
- File: `Assets/CLAWED/Scripts/Player/PlayerAnimator.cs`

### 4b. AudioManager.cs
Plays footstep sounds from `Assets/Footsteps - Essentials/` based on surface type.
- Plays horror ambient from `Assets/Horror Sfx/`
- File: `Assets/CLAWED/Scripts/Systems/AudioManager.cs`

### 4c. CameraController.cs
Third-person camera with mouse look, wall collision avoidance.
- If Cinemachine is installed, write a Cinemachine setup script instead
- File: `Assets/CLAWED/Scripts/Player/CameraController.cs`

### 4d. SaveSystem.cs
Simple JSON save/load for player stats and inventory.
- Save path: `Application.persistentDataPath/save.json`
- File: `Assets/CLAWED/Scripts/Systems/SaveSystem.cs`

---

## TASK 5 — Build for itch.io

Once scene is working:

```bash
"Z:\Dev\UNITY\Unity Hub\6000.4.0f1\Editor\Unity.exe" \
  -batchmode -quit \
  -projectPath "Z:\Dev\UNITY\BETTERNOW" \
  -buildTarget StandaloneWindows64 \
  -buildOutput "Z:\Dev\UNITY\BETTERNOW\Builds\CLAWED_v0.1" \
  -executeMethod CLAWED.Editor.BuildPipeline.BuildWindows \
  -logFile "Z:\Dev\UNITY\BETTERNOW\Logs\build.log"
```

Write `Assets/CLAWED/Editor/BuildPipeline.cs`:
```csharp
public static void BuildWindows() {
    BuildPipeline.BuildPlayer(
        new[] { "Assets/CLAWED/Scenes/PrisonLevel01.unity" },
        "Builds/CLAWED_v0.1/CLAWED.exe",
        BuildTarget.StandaloneWindows64,
        BuildOptions.None
    );
}
```

Then zip `Builds/CLAWED_v0.1/` and upload to itch.io.

---

## TASK 6 — itch.io Page

Using the `md-web` or `xurl` skill, create the itch.io page:
- Title: **CLAWED** — A Prison Survival Game
- Short description: "Escape the prison. Avoid guards. Stay alive."
- Price: $2.99 (Early Access) OR free + "pay what you want"
- Tags: survival, stealth, prison, horror, indie
- Upload the build zip
- Set release as Early Access

---

---

## TASK 7 — ClawHub Skill Publishing (parallel track with CLAWED)

Build the 24 missing ClawHub skills. Full specs in `CLAWHUB_SKILL_SPECS.md`.
Workflow in `CLAWHUB_PUBLISH_QUEUE.md`.

**THE RULE: MAX drafts. Claude reviews. Nothing publishes without approval.**

### How to build a skill

```bash
# Read the spec first
cat workspace/CLAWHUB_SKILL_SPECS.md   # find the skill you're building

# Use skill-creator to scaffold it
Read skill: skill-creator
→ Create new skill named SLUG
→ Save to workspace/clawhub-staging/SLUG/

# When done: update CLAWHUB_PUBLISH_QUEUE.md status to READY_FOR_REVIEW
```

### Build order (highest revenue first)

1. `email-agent` — core infrastructure for outreach
2. `gumroad-manager` — needed for digital product sales
3. `stripe-billing` — needed for client billing
4. `landing-page-builder` — needed for every product launch
5. `ebook-writer` — first digital product to sell
6. `sales-pipeline` — track all freelance deals
7. `lead-generator` — find clients to pitch
8. `bug-bounty-hunter` — direct revenue from security work
9. `twitter-bot` — CLAWED marketing
10. `reddit-poster` — CLAWED community building
11. `product-hunt-poster` — CLAWED launch day
12. `affiliate-tracker` — passive income tracking
13. `course-creator` — Unity course product
14. `podcast-creator` — content marketing
15-24. Remaining in any order

Do NOT rush. One well-built skill reviewed and approved beats five sloppy ones that embarrass The Hollow.

---

## Rules for MAX working on CLAWED

- Always compile-check before and after writing scripts
- Commit every working change: `git -C "Z:\Dev\UNITY\BETTERNOW" add -A && git -C "Z:\Dev\UNITY\BETTERNOW" commit -m "..."`
- Log progress in `memory/YYYY-MM-DD.md`
- If Unity batch mode errors with a script bug: fix the C# and retry
- If Unity batch mode errors with a missing package: add to `Packages/manifest.json` and retry
- Do NOT modify Grim/ or npc_casual_set_00/ asset folders — read-only purchased assets
- Goal: playable build on itch.io as fast as possible = REVENUE
