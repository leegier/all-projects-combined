# Playtest findings

Everything below was found by the automated playtest bot, the unit/integration suites, or by reviewing captured frames
(contact sheets every 4 s of the run), and is fixed in this branch. *How found* tells you which tool caught it.

## Gameplay / logic

| Finding | How found | Fix |
|---|---|---|
| Player could be locked **inside Records** — the door re-locked as the shim/keycard timer ran out | bot (timeout while leaving) | `recordsUnlocked()` stays true while the player is inside Records |
| Ledger document opened while still in Records, freezing input next to the camera | bot | document opens after leaving Records (`ledgerUnread` flag) |
| Camera sweep too fast / exposure too punishing — the shim route was unwinnable | bot (stealth checks failing) | slower sweep (0.4 rad/s), narrower cone, gentler detection, `covers()` prediction used by the bot's exposure budget |
| Forest boundary colliders were created with the wrong argument order → giant boxes that **cut the tunnel/outside nav graph off** | bot (walk timeouts after the tunnel) | corrected `addCollider` arguments |
| Player **fell through the floor** at the tunnel portal gap | bot (position check) | added a surface for the portal apron |
| Harrington stood **inside a pew collider**, and the pews overlapped the font lid | bot (lead never arrived) + stills | pews re-spaced, new waiting node `P.fh`, relaxed distance conditions |
| One key press both closed the shop/dialogue **and** re-triggered the interaction | bot | input edges are consumed on close |
| Count slot hid the hall walkers; hall counted as restricted after release → Reyes arrested the player | bot | presence keyed on `cellsReleased`; restriction only while locked in |
| Guard-reset used a non-existent nav node `I.p` | bot (exception) | nodes added, reset loop rewritten |
| Tunnel-rules scene fired before the player reached T1 | bot | lead gating flag `atT1` |
| **`Inventory.add` ignored the stack limit for a first-time stack** (`add('cigs', 100)` → 100) | unit test | clamped to the item's stack size |

## Rendering / presentation

| Finding | How found | Fix |
|---|---|---|
| Composer output black — the viewmodel pass re-cleared to the scene background | stills | `ViewmodelPass` suppresses background/fog and clears depth only |
| **Intro was black for 17 s** — the eyelid uniform was closed during the establishing + dolly shots | video review | eyelid open until the waking sequence |
| NPCs walked and faced backwards; heads were crude spheres | stills | rig flipped to the engine's heading convention; sculpted head module |
| Stacked-capsule torsos with visible seams, "diaper" pelvis, bead-like knees, neck tube mismatched in colour | stills | single lathe torso + yoke, tapered limbs with joint-centred caps, flat skin material shared by head/neck/hands |
| First-person hands looked like toes; sleeve end read as a flower pot | video review | modelled hand; sleeve runs up the arm out of frame; arm key light with clamped near field |
| Hands/arms blown out white next to ceiling fixtures | video review | viewmodel lit by an aggregate key light instead of raw world lights |
| Harrington's coat glowed white (lantern 0.35 m from his body, 9 cd) | video review | lantern carried at the hip, 5 cd, smaller glow |
| Trunk and crown of every tree used **different random transforms** (two separate draws) | code review while chunking foliage | one transform per tree shared by both meshes |
| Grass hid the two men in the ending; sun-shaft cones had hard polygon edges at the ground | stills | trodden lawn around the oak; shafts fade out before the ground |
| Records camera cone rendered as a huge opaque wedge | stills | additive `coneBeam` shader |
| Soft-shadow/foliage cost made frames 2 s+ in the forest | perf probe | chunked + LOD foliage, 1024² capture shadows |
| Tier of 12 cell doors opened at once → soundtrack clipped (peak +0.5 dBFS) | audio analysis (LUFS/peak/spectrogram) | doors staggered and thinned, limiter on the master, 32 Hz high-pass |
| Dialogue choice list sat on top of the line being answered, and then the yellow system caption covered choice 1 | video review (contact sheets of the choice screens) | subtitle lifts above the list; the caption and the assertion feed step out of the way while choices are open |
| HUD stayed on during the baptismal-font cinematic | video review | HUD hidden for that cinematic and restored at its end |

## Characters & crowd (this round)

| Finding | How found | Fix |
|---|---|---|
| Walking glTF characters **sank up to 7 cm into the floor** (planting estimated from leg lengths ignored the foot's pitch) | `tests/characters.mjs` (lowest mesh point while walking) | pelvis **ground lock**: after posing, the lowest measured sole point (ankle / ball) is put on the floor |
| VRoid bone names lost their side letter (`J_Bip_L_UpperArm` → `upperarm`); Rigify `DEF-` bones unmapped; the wrong MetaHuman jaw helper could win | unit tests of `rigmap.js` | side kept, `DEF-` stripped, `FACIAL_C_Jaw` preferred over its helpers |
| Crowd members invisible after a jump in time (the placement did not refresh visibility) | stills | `show()` on arrival and every step |
| Commissary queue stood in front of the window; the bot **stuck 6×** at (39.4, −9.1) | bot `stuck` counter (0 → 6 after adding the crowd) | queue waits beside the window; stuck back to 0 and the old sim times |
| The draw-call budget test measured **1 call** (`renderer.info` only holds the last post-processing pass) | reviewing the measured numbers | `autoReset = false`, all passes summed (≈ 500 calls / 250 k triangles added by the crowd) |
| Optimiser created the merged **jaw joint once per face skin** (6×); `meshopt` then cloned a skin per mesh, which looked like unmerged skeletons | split-skeleton test | jaw created once; "separate skeletons" is judged by joint sets, not skin count |
| A face / hair mesh on its own skeleton stays behind when the body moves | built as a deliberate control in `tests/metahuman-tools.mjs` (drift > 5 cm raw, < 1 cm optimised) | `optimize.mjs` merges skeletons by bone name |

## Process

* The capture tool can **patch** a finished render: after a UI fix, `--redo "a-b,…" --only-redo` deletes and re-renders only the
  frames whose simulation time falls in those windows (every worker re-simulates from t=0 and verifies its checkpoints, so
  the patched frames match their neighbours). A software-GL frame can take minutes when the machine is oversubscribed, so
  screenshots use a 5-minute timeout with retries instead of aborting the render.
* Capture determinism is asserted three ways: the integration test (two runs → identical end state), the plan pass
  checkpoints every 20 simulated seconds that **every worker re-verifies**, and the absence of `Math.random` / wall-clock
  reads in simulation code.
