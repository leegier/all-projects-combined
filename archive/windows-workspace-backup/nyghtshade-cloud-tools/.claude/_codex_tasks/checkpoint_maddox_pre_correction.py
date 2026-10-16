from __future__ import annotations

import csv
import hashlib
import json
import os
import shutil
from datetime import datetime
from pathlib import Path

PROJECT = Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2")
OUT_ROOT = Path(r"H:\NyghtshadeHollow_Development\2026-10-09\Maddox_Solo_Walkthrough\_Checkpoints")

SOURCES = [
    PROJECT / "Content/JERE_MetaHuman/Work_20261004_ReferenceFit",
    PROJECT / "Content/NyghtshadeHollow/CharacterRepair_20261005/Maddox",
    PROJECT / "Content/NyghtshadeHollow/CharacterRepair_20261005/BP_Maddox_Playable_Work.uasset",
    PROJECT / "Content/NyghtshadeHollow/CharacterRepair_20261005/BP_Maddox_Visual_Work.uasset",
    PROJECT / "Content/NyghtshadeHollow/CharacterRepair_20261005/BP_Maddox_TestGameMode.uasset",
    PROJECT / "Content/ThirdPerson/Blueprints/BP_ThirdPersonCharacter.uasset",
    PROJECT / "Content/Nyghtshade/Blueprints",
    PROJECT / "Content/Nyghtshade/Sequences",
    PROJECT / "Content/Nyghtshade/Maps/NH_PrisonChapelBunker_Review.umap",
    PROJECT / "Content/Python/NyghtshadeBuild",
    PROJECT / "Saved/NyghtshadeBuild/BUILD_RuntimePlayableSlice.json",
    PROJECT / "Saved/NyghtshadeBuild/AUDIT_MaddoxRuntime.json",
    PROJECT / "Saved/NyghtshadeBuild/BUILD_ChapelBunkerForest.json",
    PROJECT / "Saved/NyghtshadeBuild/VERIFY_ChapelBunkerForest_Reopen.json",
    PROJECT / "Config/DefaultEngine.ini",
    PROJECT / "Config/DefaultGame.ini",
    PROJECT / "Config/DefaultInput.ini",
    PROJECT / "MyProject2.uproject",
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(long_path(path), "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def long_path(path: Path) -> str:
    raw = str(path.resolve())
    return raw if raw.startswith("\\\\?\\") else "\\\\?\\" + raw


def source_files() -> list[Path]:
    result: list[Path] = []
    for source in SOURCES:
        if not source.exists():
            raise FileNotFoundError(source)
        if source.is_dir():
            result.extend(p for p in source.rglob("*") if p.is_file())
        else:
            result.append(source)
    return sorted(set(result), key=lambda p: str(p).lower())


def main() -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    for old in OUT_ROOT.glob("pre_Maddox_rear_correction_*"):
        if old.is_dir() and not (old / "CHECKPOINT.json").exists():
            (old / "INCOMPLETE.txt").write_text(
                "Incomplete copy attempt; do not use as a recovery checkpoint. A later verified checkpoint supersedes it.\n",
                encoding="utf-8",
            )
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    checkpoint = OUT_ROOT / f"pre_Maddox_rear_correction_{stamp}"
    checkpoint.mkdir(parents=True, exist_ok=False)

    rows = []
    for src in source_files():
        rel = src.relative_to(PROJECT)
        dst = checkpoint / rel
        os.makedirs(long_path(dst.parent), exist_ok=True)
        shutil.copy2(long_path(src), long_path(dst))
        src_hash = sha256(src)
        dst_hash = sha256(dst)
        if src_hash != dst_hash:
            raise RuntimeError(f"Hash mismatch: {rel}")
        rows.append(
            {
                "relative_path": rel.as_posix(),
                "bytes": src.stat().st_size,
                "sha256": src_hash,
                "source_last_write_utc": datetime.fromtimestamp(src.stat().st_mtime).astimezone().isoformat(),
                "copy_verified": True,
            }
        )

    with (checkpoint / "MANIFEST.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "status": "verified",
        "purpose": "Recovery checkpoint before any Maddox posterior correction or playable-assembly edit",
        "project": str(PROJECT),
        "checkpoint": str(checkpoint),
        "file_count": len(rows),
        "total_bytes": sum(row["bytes"] for row in rows),
        "all_hashes_match": all(row["copy_verified"] for row in rows),
        "preserves_current_playable_body": "/Game/JERE_MetaHuman/Work_20261004_ReferenceFit/Assembled_Codex_20261004/Maddox_ReferenceFit/Body/SKM_MH_Maddox_ReferenceFit_BodyMesh",
        "preserves_current_playable_pawn": "/Game/NyghtshadeHollow/CharacterRepair_20261005/BP_Maddox_Playable_Work",
        "notes": [
            "No project source files were modified by this checkpoint.",
            "Accepted prison packages were not copied or modified because this bounded character correction does not edit them.",
            "The full current Maddox ReferenceFit assembly and Maddox authoring/locomotion/candidate subtree are included.",
        ],
    }
    (checkpoint / "CHECKPOINT.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
