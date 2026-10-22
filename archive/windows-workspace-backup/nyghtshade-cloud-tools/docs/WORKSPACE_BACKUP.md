# Workspace backup layout

The backup is kept in content chunks. Existing Windows profile folders remain at the repository root so their original organization and shortcut references are preserved.

1. **Navigation tools and data**: `tools/`, `data/`, `requirements.txt`.
2. **Windows project context**: `docs/windows/`, `Contacts/`, `Desktop/`, `Documents/`, `Downloads/`, `Favorites/`, `Links/`, `Music/`, `OneDrive/`, `Pictures/`, `Saved Games/`, `Searches/`, and `Videos/`.
3. **Workspace and tool state**: `.claude/`, `.codex/`, `.local/`, `.sparc3d-runtime/`, `.cache/`, `.config/`, `.sbx-denybin/`, and `.thumbnails/`.

Large archives, databases, executables, media, and 3D assets are stored through Git LFS. Authentication files, token caches, local Git identity configuration, Python caches, and Git's internal `.git/` directory are not included.