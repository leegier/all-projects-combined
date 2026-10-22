"""Build a three-camera, static proof plan for the v013 bridge repair.

Offline only: reads the sealed bridge profile JSON and writes plan/evidence JSON
and Markdown.  It does not import Unreal or touch a project package.
"""

from __future__ import annotations

import bisect
import datetime as dt
import hashlib
import json
from pathlib import Path


PROFILE = Path(
    r"H:\NyghtshadeHollow_Development\2026-10-10\EnvironmentCleanup\Evidence"
    r"\NH_V012_Bridge_Deck_Profile_and_MinimalRepair_2026-10-10.json"
)
EXPECTED_PROFILE_SHA256 = (
    "F06AA16B9A5DB1A285B4D29431341C2B536E5F94BDDDA6A89745840A1B5AD6AA"
)
PLAN = Path(r"E:\_codex_tasks\nh_v013_bridge_still_proof_plan_20261010.json")
EVIDENCE_DIR = Path(
    r"H:\NyghtshadeHollow_Development\2026-10-10\EnvironmentCleanup\Evidence"
)
EVIDENCE_JSON = EVIDENCE_DIR / "NH_v013_Bridge_ThreeStill_CameraPlan_2026-10-10.json"
EVIDENCE_MD = EVIDENCE_DIR / "NH_v013_Bridge_ThreeStill_CameraPlan_2026-10-10.md"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


profile_hash = sha256(PROFILE)
if profile_hash != EXPECTED_PROFILE_SHA256:
    raise RuntimeError(f"Profile hash changed: {profile_hash}")

profile = json.loads(PROFILE.read_text(encoding="utf-8"))
rows = profile["repair_profile_25cm"]
ys = [float(row["y"]) for row in rows]
if ys != sorted(ys) or len(set(ys)) != len(ys):
    raise RuntimeError("Bridge repair profile Y values are not strictly increasing")


def road_z(y: float) -> float:
    """Linear interpolation that exactly matches the v013 repair script."""

    if y <= ys[0]:
        return float(rows[0]["road_z"])
    if y >= ys[-1]:
        return float(rows[-1]["road_z"])
    high = bisect.bisect_left(ys, y)
    low = high - 1
    alpha = (y - ys[low]) / (ys[high] - ys[low])
    return float(rows[low]["road_z"]) * (1.0 - alpha) + float(rows[high]["road_z"]) * alpha


def f(value: float) -> float:
    return round(float(value), 6)


water_z = float(profile["design_reference"]["water_z"])
camera_height = 220.0
south_y = 87400.0
south_target_y = 88900.0
north_y = 93000.0
north_target_y = 91500.0
crown_y = 90200.0

cameras = [
    {
        "id": "bridge_south_approach",
        "purpose": "Show the lower-Y Hermite approach, full-width asphalt/centre markings, and south deck join.",
        "camera_cm": [-90750.0, south_y, f(road_z(south_y) + camera_height)],
        "target_cm": [-91000.0, south_target_y, f(road_z(south_target_y) + 80.0)],
        "surface_receipt": {
            "camera_y_cm": south_y,
            "expected_road_z_cm": f(road_z(south_y)),
            "camera_above_expected_road_cm": camera_height,
            "lateral_offset_from_center_cm": 250.0,
        },
        "horizontal_fov_deg": 55.0,
        "focal_length_mm_for_36mm_sensor": 34.578,
    },
    {
        "id": "bridge_north_approach",
        "purpose": "Show the upper-Y Hermite approach, full-width asphalt/centre markings, and north deck join.",
        "camera_cm": [-91250.0, north_y, f(road_z(north_y) + camera_height)],
        "target_cm": [-91000.0, north_target_y, f(road_z(north_target_y) + 80.0)],
        "surface_receipt": {
            "camera_y_cm": north_y,
            "expected_road_z_cm": f(road_z(north_y)),
            "camera_above_expected_road_cm": camera_height,
            "lateral_offset_from_center_cm": -250.0,
        },
        "horizontal_fov_deg": 55.0,
        "focal_length_mm_for_36mm_sensor": 34.578,
    },
    {
        "id": "bridge_west_side_structure",
        "purpose": "Broadside proof of the arched bridge, its supports, deck silhouette, and water clearance without putting the camera beneath the arch.",
        "camera_cm": [-94000.0, crown_y, f(water_z + 500.0)],
        "target_cm": [-91000.0, crown_y, -1260.0],
        "surface_receipt": {
            "camera_reference": "saved water plane + 500 cm",
            "saved_water_z_cm": f(water_z),
            "camera_above_saved_water_cm": 500.0,
            "expected_crown_road_z_cm": f(road_z(crown_y)),
            "camera_minus_crown_road_z_cm": f(water_z + 500.0 - road_z(crown_y)),
        },
        "horizontal_fov_deg": 65.0,
        "focal_length_mm_for_36mm_sensor": 28.254,
    },
]

payload = {
    "title": "Nyghtshade v013 bridge repair: three native still-camera proof plan",
    "generated_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
    "classification": "offline camera plan derived from sealed static arrays; planned, not rendered",
    "target_map": "/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v013",
    "profile_source": {"path": str(PROFILE), "sha256": profile_hash},
    "repair_contract": profile["repair_contract"],
    "camera_method": {
        "approach_height": "expected repaired road profile + 220 cm",
        "side_height": "saved water plane + 500 cm",
        "filmback_mm": [36.0, 20.25],
        "focus": "disabled for geometric proof",
        "motion_blur": 0.0,
        "recommended_resolution": [1920, 1080],
        "recommended_exposure": "fixed EV100 selected from one low-cost test frame; no auto-exposure pumping",
    },
    "cameras": cameras,
    "pixel_review_gates": [
        "Both approach shots show the complete 7.30 m asphalt width and coplanar centre markings.",
        "Both deck-to-road joins are visibly continuous with no wall/crossbar through the travel surface.",
        "The broadside shot shows bridge supports, deck silhouette, and water below the crown span.",
        "No approach camera intersects the bridge underside or structural arch.",
        "A successful render is still not a possessed vehicle/player drivability test; the recorded 14.25% peak grade requires runtime traversal.",
    ],
    "runtime_collision_companion": {
        "planned_validator": "E:/_codex_tasks/validate_environment_runtime_geometryaware_v3_bridgeprofile.py",
        "required_lateral_offsets_cm_in_bridge_zone": [-330.0, -250.0, 0.0, 250.0, 330.0],
        "camera_corridor_height_cm": 220.0,
    },
    "evidence_boundary": {
        "this_plan_proves": [
            "camera and target coordinates",
            "profile-relative approach camera height",
            "side-camera height relative to the saved water plane",
        ],
        "render_required": [
            "actual visibility and exposure",
            "absence of occlusion in pixels",
            "material and marking continuity",
        ],
        "runtime_required": [
            "whole-width collision containment",
            "camera-channel clearance",
            "practical drivability over the 14.25% peak grade",
        ],
    },
}

encoded = json.dumps(payload, indent=2) + "\n"
PLAN.write_text(encoded, encoding="utf-8")
EVIDENCE_JSON.write_text(encoded, encoding="utf-8")

lines = [
    "# v013 Bridge Three-Still Camera Plan",
    "",
    "Status: **planned, not rendered**. This is an offline coordinate plan and does not prove the saved v013 map or pixels.",
    "",
    f"Target map: `{payload['target_map']}`",
    "",
    f"Profile: `{PROFILE}`  ",
    f"SHA-256: `{profile_hash}`",
    "",
    "| Still | Camera (cm) | Target (cm) | FOV | Basis |",
    "|---|---:|---:|---:|---|",
]
for camera in cameras:
    lines.append(
        "| {id} | `{camera}` | `{target}` | {fov:.0f} deg | {basis} |".format(
            id=camera["id"],
            camera=", ".join(str(value) for value in camera["camera_cm"]),
            target=", ".join(str(value) for value in camera["target_cm"]),
            fov=camera["horizontal_fov_deg"],
            basis=camera["surface_receipt"].get(
                "camera_reference", "repaired road + 220 cm"
            ),
        )
    )
lines.extend(
    [
        "",
        "Review both approach joins, the full 7.30 m road width and centre markings, then the side structure and water clearance. Runtime validation must separately sample ±250 cm and ±330 cm across the bridge zone and sweep the repaired profile at +220 cm. Practical vehicle/player traversal remains required because the calculated peak grade is 14.25%.",
        "",
    ]
)
EVIDENCE_MD.write_text("\n".join(lines), encoding="utf-8")

print(json.dumps({
    "plan": str(PLAN),
    "plan_sha256": sha256(PLAN),
    "evidence_json": str(EVIDENCE_JSON),
    "evidence_json_sha256": sha256(EVIDENCE_JSON),
    "evidence_md": str(EVIDENCE_MD),
    "evidence_md_sha256": sha256(EVIDENCE_MD),
}, indent=2))
