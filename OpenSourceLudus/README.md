# OpenSourceLudus
AI Copilot Scripts for Unity and Unreal Engine.

## What this repo provides
- **Ludus-style MCP server** with deterministic tools for asset edits, audits, and scene refactors.
- **Unity Editor console** to invoke MCP tools via JSON-RPC.
- **UE5 Python bridge** to call the same MCP tools inside Unreal's Python environment.

## Setup
```bash
npm install
npm run build
npm start
```

Server runs at `http://localhost:8787/mcp`.

### Environment variables
- `XAI_API_KEY` (optional): enables the `xai_call` tool.

## MCP tools
Each tool returns a structured response with `status`, `diff`, `affectedAssets`, and `logs`.

- `bulk_edit_assets`
- `generate_variants`
- `normalize_dps`
- `prefab_audit`
- `scene_refactor`
- `xai_call`

## Unity adapter
Drop `unity/NightshadeCommander.cs` into an Editor folder in your Unity project.

Open the console via **Ludus → Nightshade Console** and call tools against the MCP endpoint.

## Unreal Engine adapter (UE 5.7+)
Run `ue5/nightshade_bridge.py` inside UE's Python environment or standalone to test.
It calls MCP tools using JSON-RPC over HTTP.

## Notes
- These adapters are deterministic stubs intended for wiring into your asset APIs.
- Replace stub modifications with real AssetDatabase/Unreal asset operations for production use.
