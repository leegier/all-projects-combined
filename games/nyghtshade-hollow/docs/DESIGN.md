# Design brief — *The Intake* (vertical slice)

## Pillars

1. **The clock is the antagonist.** The prison runs on a schedule; the player's freedom is a function of the hour.
   Doors, guards, meals, chapel, even what counts as *trespassing* change with the slot. You win by reading the clock,
   not by out-fighting it.
2. **Rules you can see and bend.** Every restriction has a visible reason (a locked-door prompt that tells you when it
   opens, a guard whose gaze you can read, a camera whose sweep you can time) and a price to bend it (DC, standing, risk).
3. **Small, specific, human.** One morning, one ledger page, one old man. Dialogue carries world and stakes; the economy and
   reputation systems make choices cost something real.
4. **Atmosphere first.** Light, fog, sound and framing do the work a bigger budget would do with assets: a hard fluorescent
   hall, a brick tunnel with a lantern, a golden clearing that is *quiet*.

## Core loop (≈ 8 min)

```
 read the clock ─► decide where you are allowed to be ─► earn / spend DC ─► talk (standing ±) ─► get past a guard / camera ─► advance the story beat
        ▲                                                                                                                       │
        └────────────────────────────── consequences: fine, write-up, arrest (an hour lost) ◄──────────────────────────────────┘
```

## Beats

| # | Beat | Clock | Teaches |
|---|---|---|---|
| 1 | Establishing shot of the compound, dolly through C-Block, wake in cell C-107 (cinematic) | 04:58 → 05:58 | tone, setting |
| 2 | **Count** — stand at the bars; Reyes walks the tier | 06:00 | the clock, restrictions, PA |
| 3 | Pickups, fountain, day-room inmate | 06:15 | survival, interactions, dialogue |
| 4 | **Chow** — sally gates open, tray from Tuck, eat; commissary | 07:00 | meals, DC, shop |
| 5 | **Cutter** — the ledger lead; buy the shim (25 DC) or keycard (60 DC), or plan a bribe | 07:45 | reputation, branching choices |
| 6 | **Mop detail** — four spills, 30 DC | 08:00 | work, money |
| 7 | **Records** — shim / keycard / bribe, then a camera sweep; copy page 14 | 08:40 | stealth, guard AI, camera |
| 8 | Read the order, journal, wait for **13:00** (hold T) | 09:30 → 13:00 | time flow, objectives |
| 9 | **Chapel** — Harrington; give him the page; stained glass | 13:05 | NPC relationship, payoff of beat 7 |
| 10 | **Baptismal font** — hold E, the stone slides, a stair appears (cinematic) | 13:20 | spectacle, hold interactions |
| 11 | **Tunnel** — follow the lantern; Harrington's rules | 13:30 | environment storytelling |
| 12 | **The clearing** — four hours, an oak, a car in the distance, title card *FOUR HOURS* (cinematic) | 14:40 | the emotional anchor |

Failure branch (verified by the `alarm` route): rush into Records → camera spots you → alarm → Pruitt breaks his post →
arrest cinematic → −15 DC, −3 guard standing, one hour later in your cell.

## Systems (numbers)

| System | Tuning |
|---|---|
| Prison clock | 45 s real = 1 h; hold **T** = ×6 while safe; 13 schedule entries; lockdown overrides every slot |
| Survival | hunger −3.2 /h, thirst −4.2 /h (×2.2 while sprinting); health +1.2 /h when both > 40, −2.2 /h when either is 0 |
| Stamina | sprint drains, crouch moves slower and quieter; sprinting in view raises suspicion |
| Alert | heat 0–100 → 4 levels at 25 / 55 / 90; 6 s hold, then −3.5 /s; ≥ ALERT also tints the screen and plays the siren |
| Guard vision | 109° cone, 13–15 m range, line-of-sight tests against level geometry, plus hearing (noise × proximity, < 8 m); visibility falls off with distance and is ×0.55 while crouched; detection fills at *visibility × rule-breaking rate* (×1.35 in a restricted area, ×0.3 for sprinting in view, ×0.9 during an alert) and decays 0.35 /s; suspicious at 0.4, chase at 1.0, catch at 1.15 m |
| Security camera | sweeps ±0.95 rad on a 15.7 s period, 0.8 rad fov, 10.5 m; crouching lowers exposure; a full meter raises a camera alarm (heat +65) and Pruitt leaves his post |
| Economy | start 50 DC · tray free · water 3 · ramen 6 · cigarettes 10 (sell for 8) · bun 4 · mop job +30 · shim 25 · keycard 60 · bribe 40 · arrest/medical fine ≤ 15 |
| Reputation | street cred tiers Nobody < 0 ≤ Fresh < 25 ≤ Known < 80 ≤ Respected < 200 ≤ Shot-caller; fear 0–100; nine faction standings (ally ≥ 60, enemy ≤ −40) |
| Dialogue | 18 scripts / 50 nodes; effects (`fx`) set flags, move standing/fear/cred, spend DC, hand over items; conditions (`cond`) gate choices |

## Level notes

* **C-Block (hall)** — 12 two-tier cells per row on both sides, catwalks, two stairs, a glass guard booth, day-room tables,
  fountains. Ceiling is hung with tube fixtures; windows project barred cookie light by day.
* **East wing** — sally port (two gates), a long corridor, mess hall (check floor, tables, serving line, commissary, kitchen),
  the Intake desk (Pruitt), the Records Room (reader, ledger desk, ceiling camera).
* **West wing** — corridor, library, chapel (nave, pews, altar, stained glass, candles, baptismal font over a sealed stair).
* **Tunnel** — brick stair, T1 north passage, T2 west passage with a gap, a drain portal.
* **Outside** — gully, forest bowl (≈ 330 trees), the clearing with the old oak, perimeter wall, towers, floodlights, lit windows.

## Art & audio direction

*Look*: desaturated institutional blue-greens and block-wall greys, hard cool fluorescents against warm accents (lantern, candles,
low sun); film grain, vignette, slight chromatic aberration, letterbox in cinematics. *Camera*: first-person with body bob and a
low-poly tattooed forearm sleeve; dialogue and cinematics cut to authored cameras with ease curves.
*Sound*: room tone + 100 Hz hum + distant clangs/shouts indoors; drips and low drone in the tunnel; birds and wind outside;
piano motif at the end. No spoken VO in the slice — captions + voice blips.

## Backlog (from the end screen)

Yard & gym factions · visitation · hit market · Arianna's office · Valley's arrival · more NPC routines · inmate-to-inmate
AI conflicts · inventory trading · save slots.
