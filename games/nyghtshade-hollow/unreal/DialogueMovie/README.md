# "Four Hours" dialogue movie — Unreal hand-off

Everything here was made in the cloud while the PC was offline. It turns the voiced dialogue movie into
Unreal Level Sequences with the MetaHumans.

| File | What |
|---|---|
| `lines/*.wav` | 58 voice lines (48 kHz mono), verbatim from `Nyghtshade_Hollow_Dialogue.pdf`, AI voices (Kokoro) |
| `dialogue_lines.csv` | one row per line: scene, speaker, text, wav, start/end seconds (also imports as a DataTable) |
| `build_dialogue_movie.py` | editor script: imports the WAVs, builds `SEQ_FourHours_S1..S7` + `SEQ_FourHours_Master` in `/Game/NH/DialogueMovie` |
| `../../media/dialogue-movie/*.m4a` | the full mix (ambience + score) to hear the pacing |

Cast mapping (edit `CAST` in the script to match Outliner labels): **Maddox = MetaHuman Dean**, Harrington, Arianna.
Allen is a voice on the phone only. Valentino and Bridget Galletti have no lines in the current sourcebook
(it lists their scenes as "next"), so they are not in this cut.

## Prompt for the Claude session on the PC

> Work in a copy of the current map (do not touch v009). Pull branch `claude/prison-game-demo-build-mqhocm` of
> `leegier/all-projects-combined`, then run `games/nyghtshade-hollow/unreal/DialogueMovie/build_dialogue_movie.py`
> in the editor. Place Maddox (Dean), Harrington and Arianna for each scene (chapel under the baptismal, cell,
> tunnel mouth + road with a motorcycle, the 50-ft tunnel chamber empty then furnished, dinner table for three).
> For every line, make a MetaHuman Performance from the WAV (audio-driven facial animation) and put it on the
> speaker's face track at the same frame as the audio section. Replace the placeholder camera per scene with
> real coverage (wide, over-shoulder, close-ups), cut on dialogue. Render the master with Movie Render Queue,
> 1080p24, and report back with stills.
