# Maddox correction and solo walkthrough gate

Updated: 2026-10-09

## Writer and preservation gates

- [x] Confirm no Unreal Editor writer is currently running.
- [x] Confirm accepted prison source hash matches the preserved source receipt.
- [ ] Confirm live Unreal MCP/CLI connection after editor launch.
- [ ] Create a new pre-Maddox recovery checkpoint with hashes and manifest.
- [ ] Record the exact Maddox playable Blueprint, body mesh, clothing meshes, rig, animation Blueprint, and source geometry.

## Gate 1 — Maddox body correction

- [ ] Capture current side and rear baseline views.
- [ ] Diagnose whether rear projection comes from body geometry, clothing, reference pose, rig deformation, or component scaling.
- [ ] Correct the actual source on a duplicate while preserving face, height, skeleton compatibility, and all unrelated proportions.
- [ ] Verify clothing fit and animation deformation.
- [ ] Record matching side and rear after views.
- [ ] Record a short walk test.
- [ ] Lee approves the correction before walkthrough production begins.

## Gate 2 — exact solo walkthrough prerequisites

- [ ] Maddox is the only visible character.
- [ ] Chapel entrance start and aisle route verified.
- [ ] Sunken pews diagnosed and corrected without moving the gameplay floor or breaking the mechanism/stairs.
- [ ] Maddox hand contact/grab/turn interaction authored for the pulpit.
- [ ] Baptismal opens from that visible interaction.
- [ ] Every stair tread receives visible foot contact during the full descent.
- [ ] Right room is rebuilt/dressed from the actual Cigar Room pack and its reference/demo composition.
- [ ] Left/opposite room remains empty.
- [ ] Continuous route to forest and clearing verified.
- [ ] Maddox sitting animation beside the central oak verified.
- [ ] Slow 360-degree camera pan authored in chapel, cigar room, opposite room, and clearing.

## Gate 3 — sectional tests and delivery

- [ ] Chapel entrance → pulpit interaction section passes.
- [ ] Full staircase section passes.
- [ ] Cigar room and opposite room section passes.
- [ ] Tunnel → forest → oak sit section passes.
- [ ] All 360-degree room/clearing pans pass.
- [ ] Complete solo walkthrough rendered in the required order.
- [ ] Save/reopen and rerun critical checks.
- [ ] Deliver video, checkpoint, exact changed-file list, and PASS/FAIL/BLOCKED report.

## Existing verified baseline

- R24 route collision evidence exists for sustained left/right pressure and return travel.
- `/Game/Nyghtshade/Maps/NH_PrisonChapelBunker_Review` reopens with 913 actors, no required missing actors, and no test-only actors saved.
- Accepted recovered-prison source hash matches the baseline.
- Existing mechanism is proximity-triggered and does not yet satisfy the requested visible hand grab and pulpit turn.
- Final Maddox-only walkthrough has not been produced.
