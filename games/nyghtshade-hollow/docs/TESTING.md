# Test report

Generated 2026-10-15 by `node tools/report.mjs` from `docs/*-report.json`.
Run everything with `npm test` (unit → bot routes → integration).

| Suite | Result | Notes |
|---|---|---|
| Unit (Node) | ✔ 27/27 | routine, economy, reputation, survival, alert, inventory, dialogue graph |
| Bot route `shim` | ✔ 39/39 | sim 444 s · stuck 0 · end mode `end` |
| Bot route `keycard` | ✔ 39/39 | sim 429 s · stuck 0 · end mode `end` |
| Bot route `bribe` | ✔ 39/39 | sim 445 s · stuck 0 · end mode `end` |
| Bot route `alarm` | ✔ 26/26 | sim 218 s · stuck 0 · end mode `play` |
| Integration (Chromium) | ✔ 14/14 | save/load, nav graph, door policy, restricted areas, determinism |

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
| 95.3 | 07:16 | ✔ sally gate is locked during count/lights-out period |
| 95.3 | 07:16 | ✔ PA/slot change to CHOW at 07:00 |
| 96.3 | 07:18 | ✔ sally gates open during CHOW |
| 101.9 | 07:25 | ✔ arrived in the mess hall |
| 107.8 | 07:31 | ✔ got a chow tray from Tuck |
| 117 | 07:43 | ✔ ate chow — hunger restored |
| 123.5 | 07:50 | ✔ commissary UI opens |
| 149.4 | 07:54 | ✔ Cutter explained the ledger lead |
| 149.4 | 07:54 | ✔ reputation changed by dialogue choice (fear +2) |
| 149.4 | 07:54 | ✔ bought the shim (−25 DC) — balance 25 |
| 149.4 | 07:54 | ✔ mop job offered |
| 150.5 | 07:56 | ✔ took the mop |
| 170.1 | 08:22 | ✔ mop job complete (+30 DC) — balance 55 |
| 179.1 | 08:34 | ✔ walked into Intake lobby unchallenged (not restricted) |
| 199.1 | 09:00 | ✔ shim defeated the reader without raising the alert |
| 208.6 | 09:13 | ✔ inside Records (restricted area) without tripping the alarm — alert 0 |
| 211.9 | 09:18 | ✔ copied the ledger page (item in inventory) |
| 226.3 | 09:37 | ✔ left Records with no alarm raised |
| 226.3 | 09:37 | ✔ document popup shown after leaving Records |
| 231 | 09:37 | ✔ journal opens |
| 233.1 | 09:37 | ✔ journal closes |
| 245.6 | 09:54 | ✔ can sprint (stamina drains) |
| 282.8 | 13:00 | ✔ chapel unlocks at 13:00 (routine policy) |
| 284.2 | 13:01 | ✔ entered the chapel |
| 298.9 | 13:08 | ✔ Harrington accepted the ledger page |
| 298.9 | 13:08 | ✔ Street Cred / General Pop standing rose |
| 310.4 | 13:23 | ✔ baptismal font lifted — tunnel revealed |
| 326.2 | 13:33 | ✔ descended into the tunnel |
| 329.1 | 13:37 | ✔ tunnel conversation triggered |
| 338.9 | 13:37 | ✔ tunnel rules scene complete |
| 391 | 14:42 | ✔ emerged into the forest |
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
| 95.3 | 07:16 | ✔ sally gate is locked during count/lights-out period |
| 95.3 | 07:16 | ✔ PA/slot change to CHOW at 07:00 |
| 96.3 | 07:18 | ✔ sally gates open during CHOW |
| 101.9 | 07:25 | ✔ arrived in the mess hall |
| 107.8 | 07:31 | ✔ got a chow tray from Tuck |
| 117 | 07:43 | ✔ ate chow — hunger restored |
| 123.5 | 07:50 | ✔ commissary UI opens |
| 148.3 | 07:54 | ✔ Cutter explained the ledger lead |
| 148.3 | 07:54 | ✔ reputation changed by dialogue choice (fear +2) |
| 148.3 | 07:54 | ✔ mop job offered |
| 149.4 | 07:56 | ✔ took the mop |
| 169 | 08:22 | ✔ mop job complete (+30 DC) — balance 80 |
| 174.8 | 08:27 | ✔ bought the keycard (−60 DC) |
| 184.1 | 08:39 | ✔ walked into Intake lobby unchallenged (not restricted) |
| 187 | 08:43 | ✔ keycard opened the Records door |
| 192.9 | 08:51 | ✔ inside Records (restricted area) without tripping the alarm — alert 0 |
| 196.2 | 08:55 | ✔ copied the ledger page (item in inventory) |
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
| 428.9 | 14:41 | ✔ ending cinematic and end screen reached |

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
| 95.3 | 07:16 | ✔ sally gate is locked during count/lights-out period |
| 95.3 | 07:16 | ✔ PA/slot change to CHOW at 07:00 |
| 96.3 | 07:18 | ✔ sally gates open during CHOW |
| 101.9 | 07:25 | ✔ arrived in the mess hall |
| 107.8 | 07:31 | ✔ got a chow tray from Tuck |
| 117 | 07:43 | ✔ ate chow — hunger restored |
| 123.5 | 07:50 | ✔ commissary UI opens |
| 148.3 | 07:54 | ✔ Cutter explained the ledger lead |
| 148.3 | 07:54 | ✔ reputation changed by dialogue choice (fear +2) |
| 148.3 | 07:54 | ✔ mop job offered |
| 149.4 | 07:56 | ✔ took the mop |
| 169 | 08:22 | ✔ mop job complete (+30 DC) — balance 80 |
| 178 | 08:34 | ✔ walked into Intake lobby unchallenged (not restricted) |
| 189.8 | 08:34 | ✔ bribed Pruitt (−40 DC, Guards standing up) — balance 40 |
| 189.8 | 08:34 | ✔ Pruitt looks away (distracted) |
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
| 311.2 | 13:23 | ✔ baptismal font lifted — tunnel revealed |
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
| 95.3 | 07:16 | ✔ sally gate is locked during count/lights-out period |
| 95.3 | 07:16 | ✔ PA/slot change to CHOW at 07:00 |
| 96.3 | 07:18 | ✔ sally gates open during CHOW |
| 101.9 | 07:25 | ✔ arrived in the mess hall |
| 107.8 | 07:31 | ✔ got a chow tray from Tuck |
| 117 | 07:43 | ✔ ate chow — hunger restored |
| 123.5 | 07:50 | ✔ commissary UI opens |
| 149.4 | 07:54 | ✔ Cutter explained the ledger lead |
| 149.4 | 07:54 | ✔ reputation changed by dialogue choice (fear +2) |
| 149.4 | 07:54 | ✔ bought the shim (−25 DC) — balance 25 |
| 149.4 | 07:54 | ✔ mop job offered |
| 150.5 | 07:56 | ✔ took the mop |
| 170.1 | 08:22 | ✔ mop job complete (+30 DC) — balance 55 |
| 179.1 | 08:34 | ✔ walked into Intake lobby unchallenged (not restricted) |
| 199.1 | 09:00 | ✔ shim defeated the reader without raising the alert |
| 204.2 | 09:07 | ✔ security camera spotted the player and tripped the alarm — alert 2 |
| 207.9 | 09:12 | ✔ Pruitt chased the player down and arrested them |
| 215.8 | 10:14 | ✔ after the arrest: back in the own cell, fined and an hour later — balance 55 -> 40 |
| 215.8 | 10:14 | ✔ arrest cost guard standing — 3 -> 0 |

