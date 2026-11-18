from __future__ import annotations

import gzip
import json
import math
from pathlib import Path

RECEIPT = Path(r"H:\NyghtshadeHollow_Development\2026-10-05\Recovery_Inventory\MADDOX_LOCAL_MORPH_INSPECT_20261009T164751922052Z.json")
OUT = Path(r"H:\NyghtshadeHollow_Development\2026-10-09\Maddox_Solo_Walkthrough\Maddox_LocalPosterior_ROI_Analysis.json")

ROI = {
    "rear_axis": 1,
    "rear_sign": -1,
    "rear_origin_cm": 3.057861566543579,
    "rear_fade_cm": [0.0, 15.0],
    "lateral_center_cm": 0.0,
    "lateral_fade_cm": [12.0, 32.0],
    "z_fade_cm": [75.0, 93.0, 105.0, 122.0],
    "inset_cm": 3.5,
}


def smooth(a: float, b: float, value: float) -> float:
    t = max(0.0, min(1.0, (value - a) / (b - a)))
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)


def delta(point: list[float]) -> float:
    z = point[2]
    wz = smooth(75.0, 93.0, z) * (1.0 - smooth(105.0, 122.0, z))
    wx = 1.0 - smooth(12.0, 32.0, abs(point[0]))
    rear = ROI["rear_sign"] * (point[1] - ROI["rear_origin_cm"])
    wy = smooth(0.0, 15.0, rear)
    return 3.5 * wz * wx * wy


def main() -> None:
    receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))
    rows = []
    for asset in receipt["assets"]:
        for lod in asset["lods"]:
            with gzip.open(lod["source_data"], "rt", encoding="utf-8") as f:
                data = json.load(f)
            points = data["points_cm"]
            deltas = [delta(p) for p in points]
            changed = [d for d in deltas if d > 1e-7]
            rows.append(
                {
                    "role": asset["role"],
                    "source": asset["source"],
                    "lod": lod["lod"],
                    "vertices": len(points),
                    "changed_vertices": len(changed),
                    "changed_fraction": len(changed) / len(points),
                    "max_inset_cm": max(changed, default=0.0),
                    "mean_changed_inset_cm": sum(changed) / len(changed) if changed else 0.0,
                }
            )
    report = {
        "status": "read_only_native_source_roi_analysis",
        "inspection_receipt": str(RECEIPT),
        "roi": ROI,
        "basis": "Exact centimeter conversion of the rendered LocalPosterior35mm Blender candidate. FBX conversion flips the depth axis: Blender +Y posterior maps to native Unreal -Y. The native pelvis is Y=+3.0578616 cm and the shorts' native rear apex -22.48043 cm maps to the Blender +22.48043 cm receipt.",
        "results": rows,
        "build_guard_decision": {
            "body_max_changed_fraction": 0.40,
            "shorts_max_changed_fraction": 0.50,
            "reason": "The intended fitted shorts surface is expected to exceed 40% under this local ROI; the measured LOD fractions below are reviewed before authorizing a 50% garment-only ceiling. The body remains at the original 40% ceiling.",
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
