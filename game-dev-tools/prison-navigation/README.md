# nyghtshade-cloud-tools

Offline tools for inspecting prison occupancy grids and finding traversable routes.

## Repository chunks

- `tools/`: route analysis, occupancy overview generation, and the small PNG writer.
- `data/navigation/occupancy/`: source occupancy and floor grids for levels 0-2.
- `data/navigation/derived/`: clearance grid and generated overview images.
- `data/navigation/prison_zones.json`: zone metadata.

## Run

Install the dependency with `python -m pip install -r requirements.txt`, then run from the repository root:

```sh
python tools/prison_route.py
python tools/occ_overview.py
```

The overview images are written to `data/navigation/derived/`.

## Workspace backup

This private repository also preserves the surrounding Windows workspace in its original folders. See [the backup layout](docs/WORKSPACE_BACKUP.md) for the content chunks and exclusions. Large binaries use Git LFS; authentication and token files are intentionally excluded.