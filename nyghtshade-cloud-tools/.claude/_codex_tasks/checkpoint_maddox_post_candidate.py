#!/usr/bin/env python3
"""Create a bounded recovery checkpoint for the Maddox local-posterior candidate.

This script is intentionally fail-closed. It does not launch Unreal or edit the
project. It may be executed only after every UnrealEditor process has exited.

Usage after the editor/render exits:
    py E:\\_codex_tasks\\checkpoint_maddox_post_candidate.py --execute

The checkpoint stores the complete candidate folder, the exact build/test
scripts, selected proof frames and their receipts, and hash references to the
already verified 345-file pre-edit checkpoint. It also proves that the original
Maddox source chain and accepted maps still match their earlier receipts.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path


PROJECT = Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2")
WORK = Path(r"H:\NyghtshadeHollow_Development\2026-10-09\Maddox_Solo_Walkthrough")
CHECKPOINT_ROOT = WORK / "_Checkpoints"
PRECHECKPOINT = CHECKPOINT_ROOT / "pre_Maddox_rear_correction_20261009_114439"
R24_CHECKPOINT = Path(
    r"H:\NyghtshadeHollow_Development\2026-10-08\ChapelBunkerForest"
    r"\_Checkpoints\post_R24_pressure_keyboard_20261009_073139"
)
R24_REPORT = Path(
    r"H:\NyghtshadeHollow_Development\2026-10-09\WholePage_Audit"
    r"\Receipts\R24_PRESSURE_KEYBOARD_REPORT.json"
)
R24_REOPEN = Path(
    r"H:\NyghtshadeHollow_Development\2026-10-09\WholePage_Audit"
    r"\Receipts\VERIFY_ChapelBunkerForest_Reopen.json"
)
TASKS = Path(r"E:\_codex_tasks")

CANDIDATE_REL = Path(
    r"Content\NyghtshadeHollow\CharacterRepair_20261005\Maddox"
    r"\LocalPosterior_20261009T185221510217Z"
)
CANDIDATE = PROJECT / CANDIDATE_REL
CANDIDATE_ANIM_REL = CANDIDATE_REL / "Maddox_ABP_Unarmed_LocalInset35.uasset"
EXPECTED_FINAL_CANDIDATE_ANIM_SHA256 = (
    "acf0d36931f58e2ceda3650340eba65efda99630c1766dedf394d1fa07a1199e"
)

# These originals must still match the verified 345-file pre-edit checkpoint.
ORIGINALS_TO_COMPARE = [
    Path(r"Content\JERE_MetaHuman\Work_20261004_ReferenceFit\MH_Maddox_ReferenceFit.uasset"),
    Path(
        r"Content\JERE_MetaHuman\Work_20261004_ReferenceFit\Assembled_Codex_20261004"
        r"\Maddox_ReferenceFit\Face\SKM_MH_Maddox_ReferenceFit_FaceMesh.uasset"
    ),
    Path(
        r"Content\JERE_MetaHuman\Work_20261004_ReferenceFit\Assembled_Codex_20261004"
        r"\Maddox_ReferenceFit\Body\SKM_MH_Maddox_ReferenceFit_BodyMesh.uasset"
    ),
    Path(
        r"Content\JERE_MetaHuman\Work_20261004_ReferenceFit\Assembled_Codex_20261004"
        r"\Maddox_ReferenceFit\Clothing\MH_Maddox_ReferenceFit_Outfits.uasset"
    ),
    Path(
        r"Content\JERE_MetaHuman\Work_20261004_ReferenceFit\Assembled_Codex_20261004"
        r"\Maddox_ReferenceFit\Clothing\MH_Maddox_ReferenceFit_Outfits_2.uasset"
    ),
    Path(r"Content\NyghtshadeHollow\CharacterRepair_20261005\BP_Maddox_Visual_Work.uasset"),
    Path(r"Content\NyghtshadeHollow\CharacterRepair_20261005\BP_Maddox_Playable_Work.uasset"),
    Path(r"Content\NyghtshadeHollow\CharacterRepair_20261005\BP_Maddox_TestGameMode.uasset"),
    Path(
        r"Content\NyghtshadeHollow\CharacterRepair_20261005\Maddox"
        r"\Locomotion\Anims\Maddox_ABP_Unarmed.uasset"
    ),
]

ACCEPTED_SOURCE_REL = Path(r"Content\Nyghtshade\Maps\RecoveredPrisonReview.umap")
REVIEW_MAP_REL = Path(r"Content\Nyghtshade\Maps\NH_PrisonChapelBunker_Review.umap")

# Exact authoring, integration, diagnostic, proof, and finalization scripts used.
SCRIPT_NAMES = [
    "checkpoint_maddox_pre_correction.py",
    "inspect_maddox_runtime.py",
    "inspect_maddox_local_morph.py",
    "sweep_maddox_native_roi.py",
    "analyze_maddox_native_roi.py",
    "maddox_local_morph_ue58_working.py",
    "build_maddox_local_morph_candidate.py",
    "verify_maddox_candidate_and_components.py",
    "audit_maddox_blueprint_subobjects.py",
    "inspect_maddox_graphs.py",
    "integrate_maddox_local_candidate.py",
    "build_maddox_proof_studio.py",
    "render_maddox_candidate_proof.py",
    "rebind_maddox_proof_cameras.py",
    "launch_maddox_proof.ps1",
    "audit_maddox_driver_animation.py",
    "run_maddox_proof_with_telemetry.py",
    "adjust_maddox_walk_proof_speed.py",
    "audit_maddox_locomotion_graph.py",
    "maddox_candidate_ik_diagnostic.py",
    "prepare_maddox_full_walk_proof.py",
    "fix_maddox_candidate_ik_goals.py",
    "finalize_maddox_flat_walk_candidate.py",
    "checkpoint_maddox_post_candidate.py",
]

RECEIPTS = [
    "UNREAL_CONNECTION_AND_MADDOX_RUNTIME_AUDIT.json",
    "Maddox_LocalPosterior_ROI_Sweep.json",
    "Maddox_LocalPosterior_ROI_Analysis.json",
    "VERIFY_LocalPosterior_Reopen_And_Components.json",
    "Maddox_Blueprint_Subobject_Audit.json",
    "Maddox_Graph_Audit.json",
    "Candidate_Integration_Receipt.json",
    "Studio_Build_Receipt.json",
    "Studio_Camera_Rebind_Receipt.json",
    "Driver_Animation_Audit.json",
    "Locomotion_Graph_And_Clip_Audit.json",
    "Walk_Clip_And_Framing.json",
    "Final_FlatWalk_Repair.json",
    "FullWalkPrepare.log",
    "FullWalkPrepare_stdout.log",
    "IK_Goal_Repair_20261010.log",
    "IK_Goal_Repair_20261010_stdout.log",
    "Finalize_FlatWalk_20261010.log",
    "Finalize_FlatWalk_20261010_stdout.log",
    "Proof_Walk_R4.log",
    "Proof_Walk_R4_stdout.log",
    "Proof_Walk_R5_IKRestored.log",
    "Proof_Walk_R5_IKRestored_stdout.log",
]

NESTED_RECEIPTS = [
    Path(r"IK_Diagnostic\Receipt.json"),
    Path(r"IK_Goal_Repair\20261010T122808117368Z\REPAIR_RECEIPT.json"),
    Path(r"IK_Goal_Repair\20261010T122808117368Z\PRE_REPAIR_GRAPH.json"),
]

# Three fixed-camera comparison views from each side of the edit.
BEFORE_AFTER_FILES = {
    "Before": [
        Path(r"Proof_Before_R4\NH_Maddox_000024.png"),
        Path(r"Proof_Before_R4\NH_Maddox_000072.png"),
        Path(r"Proof_Before_R4\NH_Maddox_000120.png"),
        Path(r"Proof_Before_R4\RENDER_REPORT.json"),
        Path(r"Proof_Before_R4\RUNTIME_TELEMETRY.json"),
        Path(r"Proof_Before_R4\_DONE.txt"),
    ],
    "After": [
        Path(r"Proof_After_R1\NH_Maddox_000024.png"),
        Path(r"Proof_After_R1\NH_Maddox_000072.png"),
        Path(r"Proof_After_R1\NH_Maddox_000120.png"),
        Path(r"Proof_After_R1\RENDER_REPORT.json"),
        Path(r"Proof_After_R1\RUNTIME_TELEMETRY.json"),
        Path(r"Proof_After_R1\_DONE.txt"),
    ],
    # R4 is the valid scripted 300 cm/s flat-walk capture.
    "Walk_R4_Valid": [
        Path(r"Proof_Walk_R4\NH_Maddox_000000.png"),
        Path(r"Proof_Walk_R4\NH_Maddox_000036.png"),
        Path(r"Proof_Walk_R4\NH_Maddox_000072.png"),
        Path(r"Proof_Walk_R4\NH_Maddox_000108.png"),
        Path(r"Proof_Walk_R4\NH_Maddox_000143.png"),
        Path(r"Proof_Walk_R4\RENDER_REPORT.json"),
        Path(r"Proof_Walk_R4\RUNTIME_TELEMETRY.json"),
        Path(r"Proof_Walk_R4\_DONE.txt"),
    ],
    # R5 is preserved as a rejected Alpha-1 diagnostic, never as acceptance proof.
    "R5_Alpha1_RejectedDiagnostic": [
        Path(r"Proof_Walk_R5_IKRestored\NH_Maddox_000000.png"),
        Path(r"Proof_Walk_R5_IKRestored\NH_Maddox_000072.png"),
        Path(r"Proof_Walk_R5_IKRestored\NH_Maddox_000143.png"),
        Path(r"Proof_Walk_R5_IKRestored\RENDER_REPORT.json"),
        Path(r"Proof_Walk_R5_IKRestored\RUNTIME_TELEMETRY.json"),
        Path(r"Proof_Walk_R5_IKRestored\_DONE.txt"),
    ],
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def utc_iso(path: Path) -> str:
    return dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc).isoformat()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def normalize_rel(value: str | Path) -> str:
    return str(value).replace("\\", "/").lstrip("./").lower()


def unreal_processes() -> list[str]:
    result = subprocess.run(
        ["tasklist", "/FO", "CSV", "/NH"],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    found = []
    for line in result.stdout.splitlines():
        low = line.lower()
        if any(name in low for name in ("unrealeditor.exe", "unrealeditor-cmd.exe", "ue4editor.exe")):
            found.append(line)
    return found


def need_file(path: Path, label: str) -> None:
    if not path.is_file():
        raise RuntimeError(f"Missing {label}: {path}")


def copy_verified(source: Path, destination: Path, category: str, manifest: list[dict]) -> None:
    need_file(source, category)
    source_hash = sha256(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    copied_hash = sha256(destination)
    if copied_hash != source_hash:
        raise RuntimeError(f"Copy hash mismatch: {source} -> {destination}")
    manifest.append(
        {
            "category": category,
            "source": str(source),
            "checkpoint_relative_path": destination.as_posix(),
            "bytes": source.stat().st_size,
            "sha256": source_hash,
            "source_last_write_utc": utc_iso(source),
            "copy_verified": True,
        }
    )


def read_precheckpoint_manifest() -> tuple[dict[str, dict], list[dict]]:
    manifest_path = PRECHECKPOINT / "MANIFEST.csv"
    need_file(PRECHECKPOINT / "CHECKPOINT.json", "verified pre-checkpoint receipt")
    need_file(manifest_path, "verified pre-checkpoint manifest")
    receipt = load_json(PRECHECKPOINT / "CHECKPOINT.json")
    if receipt.get("status") != "verified" or receipt.get("file_count") != 345:
        raise RuntimeError("The referenced pre-checkpoint is not the verified 345-file checkpoint")
    if receipt.get("all_hashes_match") is not True:
        raise RuntimeError("The referenced pre-checkpoint did not record matching hashes")
    with manifest_path.open("r", encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    if len(rows) != 345:
        raise RuntimeError(f"Pre-checkpoint manifest has {len(rows)} rows; expected 345")
    indexed = {normalize_rel(row["relative_path"]): row for row in rows}
    return indexed, rows


def compare_originals(pre_index: dict[str, dict]) -> list[dict]:
    comparisons = []
    for rel in ORIGINALS_TO_COMPARE:
        key = normalize_rel(rel)
        if key not in pre_index:
            raise RuntimeError(f"Original is absent from pre-checkpoint manifest: {rel}")
        current = PROJECT / rel
        need_file(current, "original project asset")
        current_hash = sha256(current)
        expected = pre_index[key]["sha256"].lower()
        comparisons.append(
            {
                "relative_path": rel.as_posix(),
                "expected_precheckpoint_sha256": expected,
                "current_sha256": current_hash,
                "unchanged": current_hash == expected,
            }
        )
    changed = [item for item in comparisons if not item["unchanged"]]
    if changed:
        raise RuntimeError("Original Maddox source chain differs from pre-checkpoint: " + json.dumps(changed))
    return comparisons


def compare_accepted_maps() -> list[dict]:
    need_file(R24_REPORT, "R24 report")
    need_file(R24_REOPEN, "R24 reopen verifier")
    report = load_json(R24_REPORT)
    expected = {
        normalize_rel(ACCEPTED_SOURCE_REL): report["hashes"]["accepted_source"].lower(),
        normalize_rel(REVIEW_MAP_REL): report["hashes"]["review_map"].lower(),
    }
    comparisons = []
    for rel in (ACCEPTED_SOURCE_REL, REVIEW_MAP_REL):
        current = PROJECT / rel
        need_file(current, "accepted map")
        current_hash = sha256(current)
        wanted = expected[normalize_rel(rel)]
        comparisons.append(
            {
                "relative_path": rel.as_posix(),
                "expected_r24_sha256": wanted,
                "current_sha256": current_hash,
                "unchanged": current_hash == wanted,
            }
        )
    changed = [item for item in comparisons if not item["unchanged"]]
    if changed:
        raise RuntimeError("Accepted map hash differs from R24 receipt: " + json.dumps(changed))
    reopen = load_json(R24_REOPEN)
    if reopen.get("status") != "passed":
        raise RuntimeError("R24 reopen verifier did not record passed status")
    return comparisons


def confirm_render_outputs_stable() -> None:
    required = [
        WORK / "Proof_Walk_R4" / "_DONE.txt",
        WORK / "Proof_Walk_R5_IKRestored" / "_DONE.txt",
    ]
    for marker in required:
        need_file(marker, "completed render marker")
    watched = []
    for folder in (WORK / "Proof_Walk_R4", WORK / "Proof_Walk_R5_IKRestored"):
        watched.extend(path for path in folder.iterdir() if path.is_file())
    before = {str(path): (path.stat().st_size, path.stat().st_mtime_ns) for path in watched}
    time.sleep(2)
    after = {str(path): (path.stat().st_size, path.stat().st_mtime_ns) for path in watched}
    if before != after:
        raise RuntimeError("Proof output changed during the stability check")


def write_manifest(path: Path, rows: list[dict]) -> str:
    fields = [
        "category",
        "source",
        "checkpoint_relative_path",
        "bytes",
        "sha256",
        "source_last_write_utc",
        "copy_verified",
    ]
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    return sha256(path)


def build_report(status: dict) -> str:
    return f"""# Maddox local-posterior candidate checkpoint

Status: **{status['status']}**

This is a recovery checkpoint for the bounded candidate and its evidence. It is
not an approval of the likeness or body shape and does not make the candidate
the production pawn.

## Preserved candidate state

- Candidate body and shorts contain the localized posterior morph.
- Candidate visual, playable pawn, test GameMode, proof maps/sequences, proof
  driver, and Animation Blueprint are included.
- Final candidate Animation Blueprint SHA-256:
  `{status['candidate_anim_sha256']}`.
- The final archived Animation Blueprint is the Alpha-0 flat-walk state. R4 is
  the valid scripted 300 cm/s flat-walk capture.
- R5 Alpha-1 is retained only as a rejected diagnostic because it failed foot
  motion review. It is not acceptance evidence.

## Preservation checks

- All listed original Maddox source, face, body, clothes, Animation Blueprint,
  playable, visual, and GameMode assets match the verified 345-file pre-edit
  checkpoint.
- `RecoveredPrisonReview.umap` and `NH_PrisonChapelBunker_Review.umap` match
  the R24 receipts.
- The 345-file dependency checkpoint is referenced rather than duplicated:
  `{status['precheckpoint_reference']}`.

## Evidence limits

- No claim of 100% likeness, body approval, every-tread stair contact, sustained
  physical-keyboard movement, or functional combat is made.
- The before render completed, but its telemetry script recorded an unsupported
  bone-location API error. The image files remain valid fixed-camera comparison
  output; that telemetry is preserved as failed telemetry.
- The current character work is preserved and deferred. It should not advance
  until the user returns to it.
- The project checklist was not changed by this checkpoint.
"""


def execute() -> Path:
    active = unreal_processes()
    if active:
        raise RuntimeError("Unreal is still active; checkpoint refused:\n" + "\n".join(active))

    confirm_render_outputs_stable()
    pre_index, _ = read_precheckpoint_manifest()
    original_comparisons = compare_originals(pre_index)
    map_comparisons = compare_accepted_maps()

    candidate_anim = PROJECT / CANDIDATE_ANIM_REL
    need_file(candidate_anim, "final candidate Animation Blueprint")
    candidate_anim_hash = sha256(candidate_anim)
    if candidate_anim_hash != EXPECTED_FINAL_CANDIDATE_ANIM_SHA256:
        raise RuntimeError(
            "Final candidate AnimBP hash is unexpected. Expected Alpha-0 state "
            f"{EXPECTED_FINAL_CANDIDATE_ANIM_SHA256}, found {candidate_anim_hash}."
        )

    final_receipt = load_json(WORK / "Final_FlatWalk_Repair.json")
    if final_receipt.get("candidate_sha256_after", "").lower() != candidate_anim_hash:
        raise RuntimeError("Final flat-walk receipt does not match candidate AnimBP")
    if final_receipt.get("stair_contact_verified") is not False:
        raise RuntimeError("Final receipt evidence boundary unexpectedly changed")

    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    final_dir = CHECKPOINT_ROOT / f"post_Maddox_local_posterior_candidate_{stamp}"
    temp_dir = CHECKPOINT_ROOT / f".inprogress_post_Maddox_local_posterior_candidate_{stamp}"
    if final_dir.exists() or temp_dir.exists():
        raise RuntimeError(f"Checkpoint destination already exists: {final_dir}")
    temp_dir.mkdir(parents=True, exist_ok=False)
    manifest: list[dict] = []

    try:
        # Complete candidate package folder, preserving project-relative paths.
        for source in sorted(path for path in CANDIDATE.rglob("*") if path.is_file()):
            rel = source.relative_to(PROJECT)
            copy_verified(source, temp_dir / "ProjectCandidate" / rel, "candidate_package", manifest)

        # Exact scripts used to construct and test the candidate.
        for name in SCRIPT_NAMES:
            copy_verified(TASKS / name, temp_dir / "Scripts" / name, "build_or_test_script", manifest)

        # Receipts and logs, including honest failed/rejected diagnostics.
        for name in RECEIPTS:
            copy_verified(WORK / name, temp_dir / "Receipts" / name, "receipt_or_log", manifest)
        for rel in NESTED_RECEIPTS:
            copy_verified(WORK / rel, temp_dir / "Receipts" / rel, "nested_receipt", manifest)

        # Selected fixed-camera before/after and walk evidence.
        for label, relative_files in BEFORE_AFTER_FILES.items():
            for rel in relative_files:
                copy_verified(WORK / rel, temp_dir / "Evidence" / label / rel.name, "selected_evidence", manifest)

        # Compact motion review files already generated from the evidence.
        for name in (
            "Maddox_LocalInset35_ScriptedWalk_6s.mp4",
            "Maddox_Inset35_FlatWalk_IKBypass_Diagnostic.mp4",
        ):
            copy_verified(WORK / name, temp_dir / "Evidence" / "Video" / name, "review_video", manifest)

        # Reference the verified dependency baseline without recopying 1.12 GB.
        copy_verified(
            PRECHECKPOINT / "CHECKPOINT.json",
            temp_dir / "References" / "PreCheckpoint345" / "CHECKPOINT.json",
            "precheckpoint_reference",
            manifest,
        )
        copy_verified(
            PRECHECKPOINT / "MANIFEST.csv",
            temp_dir / "References" / "PreCheckpoint345" / "MANIFEST.csv",
            "precheckpoint_reference",
            manifest,
        )
        for source in (
            R24_REPORT,
            R24_REOPEN,
            R24_CHECKPOINT / "CHECKPOINT_STATUS.json",
            R24_CHECKPOINT / "SHA256_MANIFEST.json",
        ):
            copy_verified(source, temp_dir / "References" / "R24" / source.name, "r24_reference", manifest)

        draft = TASKS / "POST_CANDIDATE_CHECKPOINT_REPORT_DRAFT.md"
        copy_verified(draft, temp_dir / "References" / draft.name, "report_draft", manifest)

        for row in manifest:
            row["checkpoint_relative_path"] = Path(
                row["checkpoint_relative_path"]
            ).relative_to(temp_dir).as_posix()

        manifest_path = temp_dir / "SHA256_MANIFEST.csv"
        manifest_sha = write_manifest(manifest_path, manifest)
        total_bytes = sum(int(row["bytes"]) for row in manifest)
        status = {
            "status": "complete_recovery_checkpoint_character_work_deferred",
            "created_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "project": str(PROJECT),
            "checkpoint": str(final_dir),
            "candidate_project_relative_path": CANDIDATE_REL.as_posix(),
            "candidate_file_count": len([p for p in CANDIDATE.rglob("*") if p.is_file()]),
            "candidate_anim_sha256": candidate_anim_hash,
            "checkpoint_file_count_excluding_generated_status_and_report": len(manifest),
            "checkpoint_total_source_bytes": total_bytes,
            "manifest_sha256": manifest_sha,
            "precheckpoint_reference": str(PRECHECKPOINT),
            "precheckpoint_file_count": 345,
            "precheckpoint_manifest_sha256": sha256(PRECHECKPOINT / "MANIFEST.csv"),
            "original_asset_comparisons": original_comparisons,
            "accepted_map_comparisons": map_comparisons,
            "proof_boundary": {
                "valid_scripted_flat_walk": "Proof_Walk_R4 at scripted 300 cm/s",
                "rejected_diagnostic": "Proof_Walk_R5_IKRestored Alpha-1 foot-motion failure",
                "likeness_100_percent_claimed": False,
                "body_approved_claimed": False,
                "every_tread_contact_claimed": False,
                "physical_keyboard_route_claimed": False,
                "combat_claimed": False,
            },
            "checklist_modified": False,
        }
        (temp_dir / "CHECKPOINT_STATUS.json").write_text(
            json.dumps(status, indent=2), encoding="utf-8"
        )
        (temp_dir / "POST_CANDIDATE_REPORT.md").write_text(
            build_report(status), encoding="utf-8"
        )

        # Verify every copied source entry a second time before finalizing.
        for row in manifest:
            copied = temp_dir / Path(row["checkpoint_relative_path"])
            if sha256(copied) != row["sha256"]:
                raise RuntimeError(f"Final verification failed: {copied}")

        temp_dir.rename(final_dir)
        return final_dir
    except Exception as exc:
        failure = {
            "status": "failed_incomplete_checkpoint",
            "error": str(exc),
            "created_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        }
        (temp_dir / "FAILED.json").write_text(json.dumps(failure, indent=2), encoding="utf-8")
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Create the checkpoint. Omit to print the guarded plan only.",
    )
    args = parser.parse_args()
    if not args.execute:
        print("PLAN ONLY: no files copied.")
        print(f"Candidate: {CANDIDATE}")
        print(f"Destination root: {CHECKPOINT_ROOT}")
        print("Execution requires --execute and refuses to run while Unreal is active.")
        return 0
    try:
        destination = execute()
    except Exception as exc:
        print(f"CHECKPOINT REFUSED_OR_FAILED: {exc}", file=sys.stderr)
        return 2
    print(f"CHECKPOINT_COMPLETE: {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
