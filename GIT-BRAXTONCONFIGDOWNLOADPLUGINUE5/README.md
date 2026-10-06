# Nightshade Holo Site

Nightshade is a cyberpunk-styled landing page and MCP server inspired by Ludus AI workflows. The site is static and easy to deploy, and the MCP server exposes Ludus-style tools that return deterministic diffs and logs for engine automation.

## What's inside
- `index.html`, `nyghtshade.css`, `nyghtshade.js`: the landing page with smooth scroll, parallax background, and reveal animations.
- `src/index.ts`: MCP server entry that exposes a tool for calling xAI with your API key.
- `.github/workflows/deploy.yml`: combined Netlify and Vercel deployment workflow.

## Running locally
1. Install dependencies: `npm install`
2. Build the server: `npm run build`
3. Start the MCP server: `XAI_API_KEY=your_key npm start`
4. Open `index.html` in your browser to preview the landing page.

## Deploying the site
- Any static host works. For Netlify, drag-drop `index.html` (and the CSS/JS) or use the GitHub Actions workflow with `NETLIFY_SITE_ID` and `NETLIFY_ACCESS_TOKEN` secrets.
- For Vercel, set `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` secrets.

## Environment variables
- `XAI_API_KEY`: required for the MCP server tool to forward calls to xAI.

## Notes
- The site is standalone and does not require a build step.
- The MCP server exposes `/mcp` over HTTP so you can drive it from Unity, UE5, or any other host.
- Every MCP tool now returns `structuredContent` with `{ status, diff[], affectedAssets[], logs[] }` so the engine adapters can render auditable output.

## MCP tool reference
- `bulk_edit_assets`: Runs deterministic batch modifications (`modifications` map) against a target asset group. Returns diffs such as `WeaponAssets.damage -> 50`.
- `generate_variants`: Spawns the requested `count` of variants while obeying `constraints`. Diff list enumerates each created variant.
- `normalize_dps`: Applies the requested `target_dps` ± `tolerance` and reports the fields that changed.
- `prefab_audit`: Runs compliance checks (naming, collision, performance) on the specified prefab set.
- `scene_refactor`: Executes named steps (remove empty groups, rebuild navigation, etc.) on a scene/level.

Each tool always provides `structuredContent.status`, a `diff` array describing the deterministic edits, a list of `affectedAssets`, and chronological `logs` for auditing.

## Engine integrations
- `integrations/unity/NightshadeCommander.cs`: Unity EditorWindow that posts tool-specific payloads to `/mcp`, parses `structuredContent`, and shows diff/log consoles before applying changes via Unity's `AssetDatabase`/`Undo`.
- `integrations/ue5/nightshade_bridge.py`: UE5 Python bridge (5.7+) that calls each tool (`bulk_edit_assets`, `generate_variants`, `normalize_dps`, `prefab_audit`, `scene_refactor`) and logs/apply diffs using Unreal's API surface (EditorUtility/LevelLibrary). The helper functions return the RPC result so you can chain additional automation or persist the diff log.
Use these as reference adapters when wiring Ludus AI pipelines into Unity or Unreal. The adapters rely on the shared MCP tool schemas and read the `diff`/`logs` arrays to keep everything deterministic and auditable.
