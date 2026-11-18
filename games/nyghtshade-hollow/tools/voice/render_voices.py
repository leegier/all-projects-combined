"""Record every line of story/dialogue-movie/script.json with Kokoro (local, offline) and
check each take with pocketsphinx speech recognition.

usage: python render_voices.py MODEL.onnx VOICES.npz SCRIPT.json OUTDIR
writes OUTDIR/lines/<scene>_<nn>_<speaker>.wav (48 kHz mono, pitch/EQ per character)
and OUTDIR/lines.json (text, file, duration, recognition score)."""
import json, os, re, subprocess, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
from pocketsphinx import Decoder

model, voices, script_path, out = sys.argv[1:5]
script = json.load(open(script_path))
os.makedirs(f'{out}/lines', exist_ok=True)
k = Kokoro(model, voices)
dec = Decoder(samprate=16000)

def style(mix):
    v = sum(k.voices[name] * w for name, w in mix.items())
    return v / sum(mix.values())

def words(s):
    return re.findall(r"[a-z']+", s.lower())

def recog(a, sr):
    n = int(len(a) * 16000 / sr)
    a16 = np.interp(np.arange(n) / 16000, np.arange(len(a)) / sr, a)
    dec.start_utt(); dec.process_raw((np.clip(a16, -1, 1) * 32767).astype(np.int16).tobytes(), full_utt=True); dec.end_utt()
    return dec.hyp().hypstr if dec.hyp() else ''

report = []
for sc in script['scenes']:
    n = 0
    for row in sc['lines']:
        who, text = row[0], row[1]
        if who == 'ACTION':
            continue
        n += 1
        c = script['cast'][who]
        a, sr = k.create(text, voice=style(c['voice']), speed=c['speed'], lang='en-us')
        raw = f'{out}/lines/_raw.wav'
        sf.write(raw, a, sr)
        name = f"{sc['id']}_{n:02d}_{who.lower()}.wav"
        semis = c.get('pitch', 0)
        af = f"rubberband=pitch={2 ** (semis / 12):.4f}:formant=preserved," if semis else ''
        af += 'highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,aresample=48000'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', af, '-ac', '1', f'{out}/lines/{name}'], check=True)
        hyp = recog(a, sr)
        ref = words(text)
        hit = sum(1 for w in ref if w in words(hyp)) / max(1, len(ref))
        d = sf.info(f'{out}/lines/{name}').duration
        report.append({'scene': sc['id'], 'speaker': who, 'text': text, 'file': f'lines/{name}',
                       'duration': round(d, 3), 'heard': hyp, 'wordRecall': round(hit, 2)})
        print(f"{name:28s} {d:5.2f}s recall {hit:.2f}", flush=True)
os.remove(f'{out}/lines/_raw.wav')
json.dump(report, open(f'{out}/lines.json', 'w'), indent=1)
tot = sum(r['duration'] for r in report)
print('lines', len(report), 'speech seconds', round(tot, 1), 'mean recall', round(np.mean([r['wordRecall'] for r in report]), 2))
