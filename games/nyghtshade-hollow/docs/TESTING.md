# Test report

Generated 2026-10-15 by `node tools/report.mjs` from `docs/*-report.json`.
Run everything with `npm test` (unit → bot routes → integration → characters → crowd → metahuman tools).

| Suite | Result | Notes |
|---|---|---|
| Unit (Node) | ✔ 31/31 | routine, economy, reputation, survival, alert, inventory, dialogue graph |
| Bot route `shim` | ✔ 39/39 | sim 444 s · stuck 0 · end mode `end` |
| Bot route `keycard` | ✔ 39/39 | sim 429 s · stuck 0 · end mode `end` |
| Bot route `bribe` | ✔ 39/39 | sim 445 s · stuck 0 · end mode `end` |
| Bot route `alarm` | ✔ 26/26 | sim 218 s · stuck 0 · end mode `play` |
| Integration (Chromium) | ✔ 14/14 | save/load, nav graph, door policy, restricted areas, determinism |
| Characters (Chromium) | ✔ 56/56 | glTF loader, bone mapping, poses, foot planting, LOD, fallbacks, crowd + library, determinism (stand-in rigs, not MetaHumans) |
| Crowd (Chromium) | ✔ 18/18 | who is where per routine state, no overlaps, colliders, visibility, transitions, cost, simulation unchanged |
| MetaHuman tools | ✔ 15/15 | optimize.mjs on a split-skeleton export, loaded in the game |
| Drive downloader | ✔ 34/34 | drive-pull.mjs against a local Drive-shaped server: ranged reads, zip central directory (incl. zip64), selective extraction, resumable download, retries, token expiry, integrity checks |

## Unit tests

- ✔ every hour of the day maps to a schedule entry
- ✔ slots at canonical hours (06 Count, 07 Chow, 13 Chapel, 22 LightsOut)
- ✔ door/area policy follows the slot
- ✔ slot changes emit slot + pa events (and count at COUNT)
- ✔ clock advances at secondsPerHour and rolls the day over
- ✔ time scale (hold T) accelerates the clock
- ✔ lockdown lifts after its duration
- ✔ serialize/load round trip keeps hour/day and re-evaluates the slot
- ✔ schedule entries do not overlap
- ✔ spend rejects overdrafts and zero, earn tracks totals
- ✔ change events carry balance, delta and reason; log is capped
- ✔ serialize/load round trip
- ✔ tiers follow street cred thresholds
- ✔ values clamp: fear 0..100, standing -100..100
- ✔ ally / enemy thresholds and events
- ✔ every faction has a standing entry; serialize/load round trip
- ✔ hunger and thirst decay with game time; sprinting costs more
- ✔ eat/drink clamp at 100; starving drains health and can kill
- ✔ health regenerates when fed and watered
- ✔ heat maps to levels 0..3 at 25 / 55 / 90 and decays after the hold
- ✔ clear() resets immediately
- ✔ stacking, slot cap and removal
- ✔ stack limit and unique items
- ✔ serialize/load round trip is a deep copy
- ✔ every script has a start node and every next/choice target exists
- ✔ every script node is reachable from its start
- ✔ fx / cond strings used by scripts are handled by Story
- ✔ MetaHuman / UE5 skeleton: every role found, twist / corrective / facial / ik helpers ignored
- ✔ Mixamo skeleton (with and without the colon glTF strips)
- ✔ Rigify deform bones, VRM / Unity humanoid and VRoid names
- ✔ unknown skeletons are reported, not guessed

## Integration tests

- ✔ new game: intro hands control to the player
- ✔ save writes a slot in localStorage
- ✔ state was really wrecked before loading (test sanity)
- ✔ continue restores economy, inventory, reputation, clock, vitals, flags and position
- ✔ continue returns to play mode
- ✔ nav graph: no isolated waypoints (169 nodes)
- ✔ nav graph: every hop of the golden-path route is connected
- ✔ doors: sally gate locked at COUNT, open at CHOW
- ✔ doors: chapel locked before 13:00, open 13:00-15:00
- ✔ doors: cells locked at COUNT and LIGHTS OUT, open in between
- ✔ doors: Records stays locked without keycard/shim/bribe
- ✔ restricted: hall only while locked in at count
- ✔ restricted: Records always; canteen only outside meal hours; chapel only while closed
- ✔ determinism: two bot runs of the shim route end in the identical state

## Character pipeline tests

- ✔ library: all four stand-in files load, none fail
- ✔ library: MetaHuman- and Mixamo-style skeletons recognised and usable
- ✔ NPCs: every cast member got a glTF body
- ✔ NPCs: guards use the files listed for the guard looks
- ✔ NPCs: a look listed for several files spreads over them (deterministically)
- ✔ [standin-mh-a] stands on the floor, head at the requested height (0.002..1.74 m for 1.74)
- ✔ [standin-mh-a] upright (head above hips above floor) and no NaN vertices
- ✔ [standin-mh-a] faces engine forward (-Z): toes point to -Z
- ✔ [standin-mh-a] A-/T-pose arms re-hung: wrist 0.54 m below shoulder, 0.03 m out
- ✔ [standin-mh-a] sit: pelvis drops 0.3-0.7 m and the knee points forward
- ✔ [standin-mh-a] pray: kneels (pelvis 0.50 m, under a third of the height)
- ✔ [standin-mh-a] lie: body horizontal (height span < 0.6 m)
- ✔ [standin-mh-a] every pose finite, back to standing after idle
- ✔ [standin-mh-a] walking: feet stay on the floor (lowest point -0.025..0.023, mean -0.006)
- ✔ [standin-mh-a] LOD: lashes/teeth hide when far and come back near
- ✔ [standin-mh-b] stands on the floor, head at the requested height (0.002..1.78 m for 1.78)
- ✔ [standin-mh-b] upright (head above hips above floor) and no NaN vertices
- ✔ [standin-mh-b] faces engine forward (-Z): toes point to -Z
- ✔ [standin-mh-b] A-/T-pose arms re-hung: wrist 0.55 m below shoulder, 0.03 m out
- ✔ [standin-mh-b] sit: pelvis drops 0.3-0.7 m and the knee points forward
- ✔ [standin-mh-b] pray: kneels (pelvis 0.51 m, under a third of the height)
- ✔ [standin-mh-b] lie: body horizontal (height span < 0.6 m)
- ✔ [standin-mh-b] every pose finite, back to standing after idle
- ✔ [standin-mh-b] walking: feet stay on the floor (lowest point -0.026..0.023, mean -0.006)
- ✔ [standin-mh-b] LOD: lashes/teeth hide when far and come back near
- ✔ [standin-mx-a] stands on the floor, head at the requested height (0.002..1.90 m for 1.90)
- ✔ [standin-mx-a] upright (head above hips above floor) and no NaN vertices
- ✔ [standin-mx-a] faces engine forward (-Z): toes point to -Z
- ✔ [standin-mx-a] A-/T-pose arms re-hung: wrist 0.59 m below shoulder, 0.03 m out
- ✔ [standin-mx-a] sit: pelvis drops 0.3-0.7 m and the knee points forward
- ✔ [standin-mx-a] pray: kneels (pelvis 0.55 m, under a third of the height)
- ✔ [standin-mx-a] lie: body horizontal (height span < 0.6 m)
- ✔ [standin-mx-a] every pose finite, back to standing after idle
- ✔ [standin-mx-a] walking: feet stay on the floor (lowest point -0.028..0.025, mean -0.006)
- ✔ [standin-mx-a] LOD: lashes/teeth hide when far and come back near
- ✔ [standin-mx-b] stands on the floor, head at the requested height (0.002..1.74 m for 1.74)
- ✔ [standin-mx-b] upright (head above hips above floor) and no NaN vertices
- ✔ [standin-mx-b] faces engine forward (-Z): toes point to -Z
- ✔ [standin-mx-b] A-/T-pose arms re-hung: wrist 0.54 m below shoulder, 0.03 m out
- ✔ [standin-mx-b] sit: pelvis drops 0.3-0.7 m and the knee points forward
- ✔ [standin-mx-b] pray: kneels (pelvis 0.50 m, under a third of the height)
- ✔ [standin-mx-b] lie: body horizontal (height span < 0.6 m)
- ✔ [standin-mx-b] every pose finite, back to standing after idle
- ✔ [standin-mx-b] walking: feet stay on the floor (lowest point -0.025..0.023, mean -0.006)
- ✔ [standin-mx-b] LOD: lashes/teeth hide when far and come back near
- ✔ fallback ?chars=off: game boots (status none)
- ✔ fallback ?chars=off: everyone keeps the procedural body
- ✔ fallback no manifest at the location: game boots (status none)
- ✔ fallback no manifest at the location: everyone keeps the procedural body
- ✔ fallback broken manifest (one good file, a missing one, a corrupt one): game boots (status ready)
- ✔ fallback broken manifest (one good file, a missing one, a corrupt one): the good file is used, the bad ones are reported
- ✔ crowd + library: manifest "crowd" files are loaded as light variants and used for the crowd (not for NPCs)
- ✔ crowd + library: residents share baked bodies (a handful of bakes instead of one per person and pose)
- ✔ crowd + library: everyone is still placed for the current state
- ✔ embedded build: manifest, characters and their crowd variants live inside the one HTML file and are used without any network fetch
- ✔ determinism: bot route ends in the identical state with procedural and with glTF bodies

## Crowd tests

- ✔ crowd: 45 residents (one per cell but the player's) + 2 kitchen hands, every pose baked
- ✔ crowd: baked bodies are light (≤ 9k triangles on average) and share materials (< 400 in all)
- ✔ count: all 45 residents stand at their cell doors and the sleeper NPCs step aside
- ✔ lights out: the cells hold sleepers (41: four cells already have a sleeper NPC) and those NPCs are back in their bunks
- ✔ lockdown: everyone sits in their cell
- ✔ chow: the mess hall is full (diners, serving line, commissary, two cooks) and cells are mostly empty
- ✔ free time: about 21 men at the day-room tables, some in the mess hall and in cells
- ✔ chapel hours: pews and the library are used
- ✔ work / yard / gym / visitation: the block is quieter but not empty
- ✔ heights: sleepers lie on the mattress (0.44 m over the cell floor, upper tier included), everyone else at floor level
- ✔ nobody shares a seat or a cell in any state
- ✔ nobody stands or sits inside a wall or furniture (open-floor positions)
- ✔ colliders: enabled exactly for the occupied seats / queue spots
- ✔ visibility follows the active areas (cells are not drawn from the canteen)
- ✔ transitions: people drift out and in over several seconds (count drops, then fills the mess hall), never two on one seat
- ✔ cost: the busiest crowd views stay under 2400 draw calls and 1.6 M triangles (all passes summed)
- ✔ ?crowd=off: no crowd, no crowd colliders, the 24 cast members are untouched
- ✔ simulation: the bot route ends in the same state with and without the crowd (clock within 2 s), never stuck on it

## MetaHuman tool tests

- ✔ inspect: the raw export is recognised as MetaHuman-style and flagged for its separate face skeleton
- ✔ inspect: blend shapes in the export are counted and flagged
- ✔ optimize: skeletons merged (no separate-skeleton warning left) and every skin drives the same joints
- ✔ optimize: joints reduced (helpers / twist / fingers / facial collapsed) but the rig stays usable
- ✔ optimize: triangles unchanged without a budget, file much smaller (meshopt)
- ✔ optimize: morph targets removed by default (and kept with --keep-morphs)
- ✔ optimize: the face skeleton's jaw became one joint under the body's head
- ✔ optimize: socketed static meshes stay where they were (≤ 1 mm) and hang from the nearest kept joint (badge → head, radio → upper arm)
- ✔ optimize --tris: triangle budget is honoured (±40 %)
- ✔ optimize --keep-*: nothing is collapsed when asked to keep everything
- ✔ game: the raw split export loads and its rig is recognised, but the face stays behind when the head moves (why the merge exists)
- ✔ game: after optimize.mjs the face and hair follow the head (drift < 1 cm over a pose change)
- ✔ game: socketed meshes follow their bone after optimising (badge on the head, radio on the arm); in the raw file the badge stays behind
- ✔ game: the merged jaw joint is found and animates while talking
- ✔ game: a single-skeleton export kept whole works too

## Drive downloader tests

- ✔ whoami: the token is accepted and the account name is shown
- ✔ no token: exit 1 with instructions, no network call
- ✔ wrong / expired token: exit 2 with a clear message, and the token is not echoed
- ✔ list: folder contents with sizes; the token never appears in any output
- ✔ list --recursive descends into sub-folders
- ✔ toc: every entry, with its real size, from a few KB of the archive
- ✔ toc: only the end of a 3.7 MB archive was transferred (70234 bytes served)
- ✔ toc: zip64 entries (64-bit sizes and offsets in the extra field)
- ✔ extract: z64e — selected entries are byte-identical (crc checked)
- ✔ toc: zip64 end-of-central-directory record
- ✔ extract: z64d — selected entries are byte-identical (crc checked)
- ✔ toc: both zip64 forms and 777 junk bytes before the archive
- ✔ extract: z64b — selected entries are byte-identical (crc checked)
- ✔ toc: 1234 junk bytes before a plain archive (self-extractor style)
- ✔ extract: junk — selected entries are byte-identical (crc checked)
- ✔ extract --match: the DNA and the json come out intact, the 2 MB body and the 1.5 MB texture are not touched
- ✔ extract --match: only the selected entries' bytes crossed the wire (373144 of 3901309)
- ✔ extract --dry: lists what it would extract and writes nothing
- ✔ extract --max-mb: bigger entries are skipped and named
- ✔ extract without a selector refuses (no accidental 1 GB download)
- ✔ extract --all with 1 MB chunks: every entry byte-identical, including the empty one
- ✔ extract: a corrupted transfer is detected (crc / inflate), exits 1 and leaves no half-written file
- ✔ extract: an entry that tries to leave the output folder (zip-slip) is refused
- ✔ get: 3.7 MB in 1 MB chunks, 3 parallel, md5 verified, no state file left
- ✔ get: a download whose md5 differs from Drive's is reported, not accepted silently
- ✔ get --range: exactly those bytes
- ✔ get: the token expires mid-download → exit 2, progress is kept
- ✔ get: run again with a new token → only the missing chunks are fetched (10 of 15), file complete and verified
- ✔ get: two 503 answers and one dropped connection are retried transparently
- ✔ get: an unknown file is a clear error
- ✔ split: parts ≤ the size limit, listed with sha256, no token needed
- ✔ join: reassembles the identical file
- ✔ join: a damaged part is detected by its sha256
- ✔ help prints the usage

## Bot routes — assertions

The bot plays through the real input layer at a fixed 60 Hz; each line is an assertion evaluated live (time = simulated seconds).

### `shim`

| t (s) | clock | assertion |
|---|---|---|
| 34 | 05:58 | ✔ intro cinematic hands over control |
| 34 | 05:58 | ✔ player starts in cell C-107 |
| 50.7 | 06:20 | ✔ count passed (stood at the bars) |
| 55.2 | 06:26 | ✔ cell doors released after count |
| 55.2 | 06:26 | ✔ inmates visible in the hall after count |
| 56.2 | 06:27 | ✔ picked up cigarettes (inventory) |
| 87.6 | 07:06 | ✔ drinking restores thirst |
| 95.2 | 07:16 | ✔ sally gate is locked during count/lights-out period |
| 95.2 | 07:16 | ✔ PA/slot change to CHOW at 07:00 |
| 96.3 | 07:18 | ✔ sally gates open during CHOW |
| 101.8 | 07:25 | ✔ arrived in the mess hall |
| 107.7 | 07:31 | ✔ got a chow tray from Tuck |
| 117 | 07:43 | ✔ ate chow — hunger restored |
| 123.4 | 07:50 | ✔ commissary UI opens |
| 149.9 | 07:55 | ✔ Cutter explained the ledger lead |
| 149.9 | 07:55 | ✔ reputation changed by dialogue choice (fear +2) |
| 149.9 | 07:55 | ✔ bought the shim (−25 DC) — balance 25 |
| 149.9 | 07:55 | ✔ mop job offered |
| 151 | 07:56 | ✔ took the mop |
| 170.5 | 08:22 | ✔ mop job complete (+30 DC) — balance 55 |
| 179.6 | 08:34 | ✔ walked into Intake lobby unchallenged (not restricted) |
| 199.1 | 09:00 | ✔ shim defeated the reader without raising the alert |
| 208.6 | 09:13 | ✔ inside Records (restricted area) without tripping the alarm — alert 0 |
| 211.9 | 09:18 | ✔ copied the ledger page (item in inventory) |
| 226.3 | 09:37 | ✔ left Records with no alarm raised |
| 226.3 | 09:37 | ✔ document popup shown after leaving Records |
| 231 | 09:37 | ✔ journal opens |
| 233.1 | 09:37 | ✔ journal closes |
| 245.6 | 09:54 | ✔ can sprint (stamina drains) |
| 282.8 | 13:00 | ✔ chapel unlocks at 13:00 (routine policy) |
| 284.1 | 13:01 | ✔ entered the chapel |
| 298.9 | 13:08 | ✔ Harrington accepted the ledger page |
| 298.9 | 13:08 | ✔ Street Cred / General Pop standing rose |
| 310.4 | 13:23 | ✔ baptismal font lifted — tunnel revealed |
| 326.1 | 13:33 | ✔ descended into the tunnel |
| 329 | 13:37 | ✔ tunnel conversation triggered |
| 338.9 | 13:37 | ✔ tunnel rules scene complete |
| 390.9 | 14:42 | ✔ emerged into the forest |
| 444.4 | 14:42 | ✔ ending cinematic and end screen reached |

### `keycard`

| t (s) | clock | assertion |
|---|---|---|
| 34 | 05:58 | ✔ intro cinematic hands over control |
| 34 | 05:58 | ✔ player starts in cell C-107 |
| 50.7 | 06:20 | ✔ count passed (stood at the bars) |
| 55.2 | 06:26 | ✔ cell doors released after count |
| 55.2 | 06:26 | ✔ inmates visible in the hall after count |
| 56.2 | 06:27 | ✔ picked up cigarettes (inventory) |
| 87.6 | 07:06 | ✔ drinking restores thirst |
| 95.2 | 07:16 | ✔ sally gate is locked during count/lights-out period |
| 95.2 | 07:16 | ✔ PA/slot change to CHOW at 07:00 |
| 96.3 | 07:18 | ✔ sally gates open during CHOW |
| 101.8 | 07:25 | ✔ arrived in the mess hall |
| 107.7 | 07:31 | ✔ got a chow tray from Tuck |
| 117 | 07:43 | ✔ ate chow — hunger restored |
| 123.4 | 07:50 | ✔ commissary UI opens |
| 148.7 | 07:55 | ✔ Cutter explained the ledger lead |
| 148.7 | 07:55 | ✔ reputation changed by dialogue choice (fear +2) |
| 148.7 | 07:55 | ✔ mop job offered |
| 149.8 | 07:56 | ✔ took the mop |
| 169.4 | 08:22 | ✔ mop job complete (+30 DC) — balance 80 |
| 175.2 | 08:27 | ✔ bought the keycard (−60 DC) |
| 184.5 | 08:40 | ✔ walked into Intake lobby unchallenged (not restricted) |
| 187.5 | 08:44 | ✔ keycard opened the Records door |
| 193.1 | 08:51 | ✔ inside Records (restricted area) without tripping the alarm — alert 0 |
| 196.5 | 08:55 | ✔ copied the ledger page (item in inventory) |
| 210.6 | 09:14 | ✔ left Records with no alarm raised |
| 210.6 | 09:14 | ✔ document popup shown after leaving Records |
| 215.2 | 09:14 | ✔ journal opens |
| 217.4 | 09:15 | ✔ journal closes |
| 229.7 | 09:31 | ✔ can sprint (stamina drains) |
| 267.2 | 13:00 | ✔ chapel unlocks at 13:00 (routine policy) |
| 268.6 | 13:01 | ✔ entered the chapel |
| 283.3 | 13:08 | ✔ Harrington accepted the ledger page |
| 283.3 | 13:08 | ✔ Street Cred / General Pop standing rose |
| 294.8 | 13:23 | ✔ baptismal font lifted — tunnel revealed |
| 310.6 | 13:33 | ✔ descended into the tunnel |
| 313.5 | 13:37 | ✔ tunnel conversation triggered |
| 323.3 | 13:37 | ✔ tunnel rules scene complete |
| 375.4 | 14:41 | ✔ emerged into the forest |
| 428.8 | 14:41 | ✔ ending cinematic and end screen reached |

### `bribe`

| t (s) | clock | assertion |
|---|---|---|
| 34 | 05:58 | ✔ intro cinematic hands over control |
| 34 | 05:58 | ✔ player starts in cell C-107 |
| 50.7 | 06:20 | ✔ count passed (stood at the bars) |
| 55.2 | 06:26 | ✔ cell doors released after count |
| 55.2 | 06:26 | ✔ inmates visible in the hall after count |
| 56.2 | 06:27 | ✔ picked up cigarettes (inventory) |
| 87.6 | 07:06 | ✔ drinking restores thirst |
| 95.2 | 07:16 | ✔ sally gate is locked during count/lights-out period |
| 95.2 | 07:16 | ✔ PA/slot change to CHOW at 07:00 |
| 96.3 | 07:18 | ✔ sally gates open during CHOW |
| 101.8 | 07:25 | ✔ arrived in the mess hall |
| 107.7 | 07:31 | ✔ got a chow tray from Tuck |
| 117 | 07:43 | ✔ ate chow — hunger restored |
| 123.4 | 07:50 | ✔ commissary UI opens |
| 148.7 | 07:55 | ✔ Cutter explained the ledger lead |
| 148.7 | 07:55 | ✔ reputation changed by dialogue choice (fear +2) |
| 148.7 | 07:55 | ✔ mop job offered |
| 149.8 | 07:56 | ✔ took the mop |
| 169.4 | 08:22 | ✔ mop job complete (+30 DC) — balance 80 |
| 178.5 | 08:34 | ✔ walked into Intake lobby unchallenged (not restricted) |
| 190.3 | 08:35 | ✔ bribed Pruitt (−40 DC, Guards standing up) — balance 40 |
| 190.3 | 08:35 | ✔ Pruitt looks away (distracted) |
| 208.6 | 08:59 | ✔ inside Records (restricted area) without tripping the alarm — alert 0 |
| 211.9 | 09:04 | ✔ copied the ledger page (item in inventory) |
| 226.3 | 09:23 | ✔ left Records with no alarm raised |
| 226.3 | 09:23 | ✔ document popup shown after leaving Records |
| 231 | 09:23 | ✔ journal opens |
| 233.1 | 09:23 | ✔ journal closes |
| 245.6 | 09:40 | ✔ can sprint (stamina drains) |
| 283.5 | 13:00 | ✔ chapel unlocks at 13:00 (routine policy) |
| 284.9 | 13:02 | ✔ entered the chapel |
| 299.6 | 13:08 | ✔ Harrington accepted the ledger page |
| 299.6 | 13:08 | ✔ Street Cred / General Pop standing rose |
| 311.1 | 13:23 | ✔ baptismal font lifted — tunnel revealed |
| 326.9 | 13:33 | ✔ descended into the tunnel |
| 329.8 | 13:37 | ✔ tunnel conversation triggered |
| 339.7 | 13:37 | ✔ tunnel rules scene complete |
| 391.7 | 14:42 | ✔ emerged into the forest |
| 445.2 | 14:42 | ✔ ending cinematic and end screen reached |

### `alarm`

| t (s) | clock | assertion |
|---|---|---|
| 34 | 05:58 | ✔ intro cinematic hands over control |
| 34 | 05:58 | ✔ player starts in cell C-107 |
| 50.7 | 06:20 | ✔ count passed (stood at the bars) |
| 55.2 | 06:26 | ✔ cell doors released after count |
| 55.2 | 06:26 | ✔ inmates visible in the hall after count |
| 56.2 | 06:27 | ✔ picked up cigarettes (inventory) |
| 87.6 | 07:06 | ✔ drinking restores thirst |
| 95.2 | 07:16 | ✔ sally gate is locked during count/lights-out period |
| 95.2 | 07:16 | ✔ PA/slot change to CHOW at 07:00 |
| 96.3 | 07:18 | ✔ sally gates open during CHOW |
| 101.8 | 07:25 | ✔ arrived in the mess hall |
| 107.7 | 07:31 | ✔ got a chow tray from Tuck |
| 117 | 07:43 | ✔ ate chow — hunger restored |
| 123.4 | 07:50 | ✔ commissary UI opens |
| 149.9 | 07:55 | ✔ Cutter explained the ledger lead |
| 149.9 | 07:55 | ✔ reputation changed by dialogue choice (fear +2) |
| 149.9 | 07:55 | ✔ bought the shim (−25 DC) — balance 25 |
| 149.9 | 07:55 | ✔ mop job offered |
| 151 | 07:56 | ✔ took the mop |
| 170.5 | 08:22 | ✔ mop job complete (+30 DC) — balance 55 |
| 179.6 | 08:34 | ✔ walked into Intake lobby unchallenged (not restricted) |
| 199.1 | 09:00 | ✔ shim defeated the reader without raising the alert |
| 204.2 | 09:07 | ✔ security camera spotted the player and tripped the alarm — alert 2 |
| 207.9 | 09:12 | ✔ Pruitt chased the player down and arrested them |
| 215.8 | 10:14 | ✔ after the arrest: back in the own cell, fined and an hour later — balance 55 -> 40 |
| 215.8 | 10:14 | ✔ arrest cost guard standing — 3 -> 0 |

