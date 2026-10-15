from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"H:\NyghtshadeHollow_Development\2026-10-09\WholePage_Audit")
SHOTS = ROOT / "Screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest().upper()


def font(size: int, bold: bool = False):
    names = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def make_sheet(output: Path, title: str, entries: list[tuple[str, Path]], cols: int = 2):
    cell_w, cell_h = 900, 560
    title_h = 90
    rows = (len(entries) + cols - 1) // cols
    canvas = Image.new("RGB", (cell_w * cols, title_h + cell_h * rows), (20, 23, 28))
    draw = ImageDraw.Draw(canvas)
    draw.text((26, 20), title, fill=(244, 247, 250), font=font(34, True))
    draw.text((26, 60), "Actual saved Unreal captures; captions identify what each image proves.", fill=(170, 180, 192), font=font(18))
    for i, (label, src) in enumerate(entries):
        x = (i % cols) * cell_w
        y = title_h + (i // cols) * cell_h
        draw.rectangle((x + 10, y + 10, x + cell_w - 10, y + cell_h - 10), fill=(31, 35, 42), outline=(75, 83, 95), width=2)
        with Image.open(src) as im:
            im = im.convert("RGB")
            max_w, max_h = cell_w - 40, cell_h - 86
            scale = min(max_w / im.width, max_h / im.height)
            resized = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.Resampling.LANCZOS)
            px = x + (cell_w - resized.width) // 2
            py = y + 22
            canvas.paste(resized, (px, py))
        draw.text((x + 24, y + cell_h - 54), label, fill=(238, 242, 246), font=font(20, True))
    canvas.save(output, quality=94)


mine_entries = [
    ("Mine tunnel art pass", Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\CaveNetworkRebuild\HeadlessReview\mine_final.png")),
    ("Flooded route / standing water", Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\CaveNetworkRebuild\HeadlessReview\water_final.png")),
    ("Cathedral of Stone cavern", Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\CaveNetworkRebuild\V4Review\cathedral_of_stone.png")),
    ("Twin connected rail lanes", Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\CaveNetworkRebuild\V5RuntimeReview\twin_tracks_200.png")),
    ("Running mine torch / flame", Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\CaveNetworkRebuild\V5TorchIntensityAB\torch_live_0_intensity_40.png")),
    ("Built fissure mouth and interior", Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\CaveNetworkRebuild\V5FissureFacetedReview\fissure_vertical_split_context.png")),
]

chapel_base = Path(r"H:\NyghtshadeHollow_Development\2026-10-08\ChapelBunkerForest\ReviewStills_R5")
chapel_entries = [
    ("46-tread concealed descent", chapel_base / "NH_0135.png"),
    ("Square concrete utility tunnel", chapel_base / "NH_0225.png"),
    ("Opposed-room junction", chapel_base / "NH_0315.png"),
    ("Furnished 50 x 50 ft right room", chapel_base / "NH_0405.png"),
    ("Dense forest approach", chapel_base / "NH_0495.png"),
    ("Massive oak reveal", chapel_base / "NH_0585.png"),
    ("Mausoleum exterior", chapel_base / "NH_0675.png"),
    ("Underground shelter review interior", chapel_base / "NH_0765.png"),
]

runtime_entries = [
    ("Closed-start gameplay", Path(r"H:\NyghtshadeHollow_Development\2026-10-08\ChapelBunkerForest\RuntimeProof_R11\01_before_interaction.png")),
    ("Baptismal moved; descent exposed", Path(r"H:\NyghtshadeHollow_Development\2026-10-08\ChapelBunkerForest\RuntimeProof_R11\02_after_interaction.png")),
    ("Full route: lower landing", Path(r"H:\NyghtshadeHollow_Development\2026-10-08\ChapelBunkerForest\RuntimeProof_R22_FullRoute\R22A_lower_landing.png")),
    ("Full route: adjoining tunnel", Path(r"H:\NyghtshadeHollow_Development\2026-10-08\ChapelBunkerForest\RuntimeProof_R22_FullRoute\R22A_tunnel.png")),
    ("Sustained left-edge containment", Path(r"H:\NyghtshadeHollow_Development\2026-10-08\ChapelBunkerForest\RuntimeProof_R24_SustainedPressure\R24_LEFT_PRESSURE_PASS_mid_stairs_outward.png")),
    ("Physical Space-key jump", Path(r"H:\NyghtshadeHollow_Development\2026-10-08\ChapelBunkerForest\RuntimeProof_R24_SustainedPressure\R24_PHYSICAL_KEYBOARD_SPACE_JUMP.png")),
]

for label, path in mine_entries + chapel_entries + runtime_entries:
    if not path.exists() or path.stat().st_size == 0:
        raise FileNotFoundError(f"Missing screenshot for {label}: {path}")

make_sheet(SHOTS / "01_MINE_DONE_PROOF.png", "Nyghtshade Mine — Built Work Proof", mine_entries)
make_sheet(SHOTS / "02_CHAPEL_BUNKER_FOREST_DONE_PROOF.png", "Chapel / Bunker / Forest — Saved Review Map", chapel_entries)
make_sheet(SHOTS / "03_RUNTIME_DONE_PROOF.png", "Chapel Route — Runtime Test Proof", runtime_entries)

copy_sources = {
    "R24_PRESSURE_KEYBOARD_REPORT.json": Path(r"H:\NyghtshadeHollow_Development\2026-10-08\ChapelBunkerForest\RuntimeProof_R24_SustainedPressure\R24_PRESSURE_KEYBOARD_REPORT.json"),
    "R22_FULL_ROUTE_REPORT.json": Path(r"H:\NyghtshadeHollow_Development\2026-10-08\ChapelBunkerForest\RuntimeProof_R22_FullRoute\R22_FULL_ROUTE_REPORT.json"),
    "R21_PERSISTENCE_REPORT.json": Path(r"H:\NyghtshadeHollow_Development\2026-10-08\ChapelBunkerForest\RuntimeProof_R21_SaveGame\R21_PERSISTENCE_REPORT.json"),
    "BUILD_ChapelBunkerForest.json": Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\NyghtshadeBuild\BUILD_ChapelBunkerForest.json"),
    "VERIFY_ChapelBunkerForest_Reopen.json": Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\NyghtshadeBuild\VERIFY_ChapelBunkerForest_Reopen.json"),
    "CART_REMOVAL_20261005_RESULT.json": Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\CaveNetworkRebuild\CART_REMOVAL_20261005_RESULT.json"),
    "HEADLESS_NORMAL_V5_SUMMARY.json": Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\CaveNetworkRebuild\HEADLESS_NORMAL_V5_SUMMARY.json"),
    "CURRENT_BUILD_V5.md": Path(r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\CaveNetworkRebuild\CURRENT_BUILD_V5.md"),
}
receipts = ROOT / "Receipts"
receipts.mkdir(exist_ok=True)
receipt_hashes = {}
for name, src in copy_sources.items():
    if src.exists():
        dst = receipts / name
        shutil.copy2(src, dst)
        receipt_hashes[name] = sha256(dst)

done = [
    {
        "item": "Mine carts were removed and guarded against recreation.",
        "detail": "33 placed cart actors and four cart Blueprints were removed; zero remained after restart. Tracks and the rail route were preserved. Both cart installers are disabled and twelve offline dressing/FX checks spawned zero carts.",
        "proof": ["Receipts/CART_REMOVAL_20261005_RESULT.json", r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\CaveNetworkRebuild\MINE_CART_REMOVAL_20261005.md"],
    },
    {
        "item": "The accepted prison source was preserved and an additive review map was saved.",
        "detail": "RecoveredPrisonReview stayed hash-identical at DCAD1878…B3535. NH_PrisonChapelBunker_Review reopened with 913 actors, no duplicate labels, no missing required actors, and no test-only actors.",
        "proof": ["Receipts/VERIFY_ChapelBunkerForest_Reopen.json", "Receipts/R24_PRESSURE_KEYBOARD_REPORT.json"],
    },
    {
        "item": "The chapel-to-bunker-to-forest layout exists as saved Unreal geometry.",
        "detail": "It includes the concealed 46-tread descent, a square 12 x 12 ft concrete tunnel, a 100 ft room station, opposed 50 x 50 ft rooms, a 450 ft continuation, a 100 ft forest approach, and the oak centered to 0.1 cm. The right room is furnished and the left room is structurally matching and empty.",
        "proof": ["Screenshots/02_CHAPEL_BUNKER_FOREST_DONE_PROOF.png", "Receipts/BUILD_ChapelBunkerForest.json", "Receipts/VERIFY_ChapelBunkerForest_Reopen.json"],
    },
    {
        "item": "The bunker utility dressing is built.",
        "detail": "The saved map records 55 left-side pipe modules, 108 hanging cable segments, 28 lights, and a continuous central flush drainage grate.",
        "proof": ["Screenshots/02_CHAPEL_BUNKER_FOREST_DONE_PROOF.png", "Receipts/BUILD_ChapelBunkerForest.json"],
    },
    {
        "item": "The chapel mechanism works in the review slice and restores across a fresh process.",
        "detail": "The pulpit rotates, the baptismal slides to expose the descent, collision is disabled in the open state, and R21 restored the open state from an isolated save. The ordinary next launch was returned to closed.",
        "proof": ["Screenshots/03_RUNTIME_DONE_PROOF.png", "Receipts/R21_PERSISTENCE_REPORT.json", "Receipts/R24_PRESSURE_KEYBOARD_REPORT.json"],
    },
    {
        "item": "The chapel stair/tunnel route passed game-side traversal and both-edge containment tests.",
        "detail": "A possessed pawn traversed chapel → aperture → stairs → lower landing → tunnel → chapel in closed-start and fresh-process restored runs. Sustained game-side pressure on the left and right edges remained Walking with IsFalling=false. A real Space-key event visibly produced a jump.",
        "proof": ["Screenshots/03_RUNTIME_DONE_PROOF.png", "Receipts/R22_FULL_ROUTE_REPORT.json", "Receipts/R24_PRESSURE_KEYBOARD_REPORT.json"],
    },
    {
        "item": "The large mine layout, elevations, caverns, lakes, and flooded crossing are built and have representative runtime checks.",
        "detail": "The V4/V5 receipts record five offset districts, four descents, three landmark caverns, two lakes, a preserved flooded swim-through, and a 13.528 km walking route. Eleven representative normal movement/swim routes passed without overriding movement mode.",
        "proof": ["Screenshots/01_MINE_DONE_PROOF.png", "Receipts/HEADLESS_NORMAL_V5_SUMMARY.json", "Receipts/CURRENT_BUILD_V5.md"],
    },
    {
        "item": "The twin-track rail infrastructure remains built after cart deletion.",
        "detail": "The closed outgoing/return circuit measures 15.214305 km with 16,276 spline points, 6,083 rail sections, seven named stations, and twelve directional stops. Current cart count is intentionally zero because the later deletion request superseded the earlier moving-cart request.",
        "proof": ["Screenshots/01_MINE_DONE_PROOF.png", "Receipts/HEADLESS_NORMAL_V5_SUMMARY.json", "Receipts/CART_REMOVAL_20261005_RESULT.json"],
    },
    {
        "item": "Mine torches and the secondary fissure geometry exist.",
        "detail": "Eighteen torch fixtures use running flame, ember, and smoke Niagara effects. Twelve dry bypasses provide 24 mouths and about 1.584 km of enclosed narrow passages; player exclusion geometry was numerically checked.",
        "proof": ["Screenshots/01_MINE_DONE_PROOF.png", "Receipts/CURRENT_BUILD_V5.md"],
    },
    {
        "item": "Graveyard, mausoleum, casket doors, stairs, corridor, and shelter geometry are placed in the additive map.",
        "detail": "The saved build records 30 graves, a mausoleum shell, two hinged casket doors, 34 provisional walnut/mahogany-look stair treads, a corridor, and a luxury-shelter review shell. CC0 graveyard/coffin assets were imported with a license receipt.",
        "proof": ["Screenshots/02_CHAPEL_BUNKER_FOREST_DONE_PROOF.png", "Receipts/BUILD_ChapelBunkerForest.json", r"C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Saved\NyghtshadeBuild\IMPORT_Graveyard_CC0.json"],
    },
    {
        "item": "Recovery evidence and review media were preserved.",
        "detail": "The R24 checkpoint has 120 manifest entries, the accepted prison hash matches, and the active mechanism test save was retired. The recovered 36-second cleanup video exists in both 1080p and phone versions on H:.",
        "proof": [r"H:\NyghtshadeHollow_Development\2026-10-08\ChapelBunkerForest\_Checkpoints\post_R24_pressure_keyboard_20261009_073139\CHECKPOINT_STATUS.json", r"H:\NyghtshadeHollow_Development\2026-10-08\ClaudeReview\Review_Media\Nyghtshade_36s_Cleanup_R3B_1080p.mp4"],
    },
]

not_done = [
    {
        "item": "The chapel/bunker/forest route is not AAA final art.",
        "detail": "The actual captures show provisional pulpit/baptismal materials, an overexposed chapel, simple concrete repetition, a very dark forest/oak reveal, and review-grade furniture/shelter dressing. The R5 exposure QA flags one unusably dark frame, and runtime still reports an approximately 114,000 MiB / 400 MiB ray-tracing resident-geometry warning.",
    },
    {
        "item": "Sustained physical W/A/S/D traversal is not verified.",
        "detail": "R24 could send key taps and visibly verify Space jump, but the available automation API could not hold movement keys. The full route passed through game-side AddMovementInput; Lee's manual held-key route test remains required.",
    },
    {
        "item": "The mausoleum casket/heart-release gameplay interaction is not hooked up or runtime tested.",
        "detail": "The button and interaction volume are placed, and the cinematic sequence contains casket-door keys, but BUILD_ChapelBunkerForest explicitly records PENDING_HOOKUP.",
    },
    {
        "item": "The additive chapel route is not proven as a seamless playable connection inside the accepted prison map.",
        "detail": "It is positioned east of the accepted prison in NH_PrisonChapelBunker_Review. Preservation is proven; a final production integration/streaming connection is not.",
    },
    {
        "item": "Maddox is not the approved final MetaHuman likeness or body.",
        "detail": "The playable pawn still references SKM_MH_Maddox_ReferenceFit_BodyMesh, which the brief rejects. The rear-projection/body correction, exact face fit, abs/nipples/navel/hair/material restoration, comparison views, and approval gate are not complete.",
    },
    {
        "item": "Arianna is not the approved final MetaHuman likeness or bikini-reference body.",
        "detail": "Animation, retarget, and playable test assets exist, but no verified final head/body conform matches the supplied blonde-face and bikini-body references. MetaHuman hair, comparison views, and user likeness approval are absent.",
    },
    {
        "item": "The requested tattoo set is not applied and deformation-tested on Maddox.",
        "detail": "The skull, sleeves, Justin memorial, ARIANNA neck wrap, Braxton, Melody/music note, opposite-eye motif, Jack, Mariah, and three crows remain concept/reference work rather than a verified in-game skin material.",
    },
    {
        "item": "Both lead characters do not have fully verified movement and combat demonstrations.",
        "detail": "Blueprints, retargeted clips, and training components exist. There is no complete saved/reopened proof for each character covering idle, walk, run, turn, jump/land, attack, block, hit detection, damage/reaction, recovery, and recorded gameplay.",
    },
    {
        "item": "Crackwalker/creeper/crawler gameplay is not implemented.",
        "detail": "The creature audit found no real creature mesh, capsule, controller, behavior tree, squeeze animation, traversal component, or persistence system. Fissure geometry exists, but AI entry/traverse/exit, retreat, warnings, occupied exits, save/load, and streaming tests are unbound.",
    },
    {
        "item": "The white/red four-wheel Minetruck/ATV gameplay vehicle is not imported or playable.",
        "detail": "The Minetruck MT2010 listing was identified, but download required the user's Epic login/agreement. It is not in the project, and the deleted rail carts are not a substitute.",
    },
    {
        "item": "The mine is not at a final accepted visual/gameplay state.",
        "detail": "The V5 document still lists final normal-character regression/fissure visual retest/final saved-state audit as in-progress at that point, raw keyboard/gamepad validation was pending, and representative route tests do not prove every square metre. Current screenshots also show over-bright lighting and visible repetition that need an art pass.",
    },
    {
        "item": "The requested atmosphere pass is incomplete.",
        "detail": "There is no complete evidence package for dust, localized fog/steam, animated water, reflections, sound, bioluminescent color, torch smoke balance, and performance across the mine and chapel route.",
    },
    {
        "item": "The 36-second Maddox/Harrington scene is not a finished character-accurate cinematic.",
        "detail": "A cleanup video file exists, but the audit states the actors labeled Maddox and Harrington are stock BP_Erno and BP_Keiji stand-ins. Walk repair and final approved likeness casting are not complete.",
    },
    {
        "item": "The outreach/video-upload package is not complete.",
        "detail": "There is no finished organized episode containing repeated build captures, a human-sounding narration track, script, captions, edited screen recording, thumbnails, and uploaded/published deliverable. Existing stills and the recovered cleanup clip are source material only.",
    },
    {
        "item": "The standalone Arianna image-edit request has no verified delivered result.",
        "detail": "No evidence was found for the final transparent-background photoreal edit with the platform removed and feet placed flat on the ground.",
    },
    {
        "item": "The complete pack inventory, final license clearance, performance profile, and December 2026 release estimate are not finished.",
        "detail": "Several inventories and audits exist, but the requested whole-drive usable-asset catalog, resolved cigar-room provenance, standalone performance run, release baseline, and evidence-based schedule are not complete.",
    },
]

audit = {
    "generated_local": "2026-10-09",
    "scope": "All substantive project requests visible in the current task page",
    "rule": "Partial, proposed, script-only, historical, or unverified work is listed as not done unless a separately bounded sub-result has direct evidence.",
    "done": done,
    "not_done": not_done,
    "receipt_sha256": receipt_hashes,
}
(ROOT / "AUDIT_EVIDENCE.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")

def md_link(path: str) -> str:
    return path.replace("\\", "/")

lines = [
    "# Nyghtshade Hollow whole-page audit — 2026-10-09",
    "",
    "Scope: every substantive project request visible in this task page. Audit rule: partial, proposed, script-only, historical, or unverified work is not credited as finished. Where one bounded part is proven and the larger request is unfinished, the proven part appears in **Done** and the remaining work appears in **Not done**.",
    "",
    "## Done",
    "",
]
for i, item in enumerate(done, 1):
    lines.append(f"{i}. **{item['item']}** {item['detail']}")
    lines.append("")
    lines.append("   Proof:")
    for proof in item["proof"]:
        if ":\\" in proof:
            lines.append(f"   - `{proof}`")
        else:
            lines.append(f"   - [{Path(proof).name}]({md_link(proof)})")
    lines.append("")

lines += ["## Not done", ""]
for i, item in enumerate(not_done, 1):
    lines.append(f"{i}. **{item['item']}** {item['detail']}")
    lines.append("")

lines += [
    "Evidence contact sheets:",
    "",
    "- [Mine built-work proof](Screenshots/01_MINE_DONE_PROOF.png)",
    "- [Chapel, bunker, forest, mausoleum, and shelter review proof](Screenshots/02_CHAPEL_BUNKER_FOREST_DONE_PROOF.png)",
    "- [Mechanism, route, collision, and input runtime proof](Screenshots/03_RUNTIME_DONE_PROOF.png)",
]
(ROOT / "DONE_VS_NOT_DONE.md").write_text("\n".join(lines), encoding="utf-8")

manifest = []
for path in sorted(ROOT.rglob("*")):
    if path.is_file():
        manifest.append({"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size, "sha256": sha256(path)})
(ROOT / "MANIFEST.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

print(json.dumps({"root": str(ROOT), "done_count": len(done), "not_done_count": len(not_done), "manifest_files": len(manifest)}, indent=2))
