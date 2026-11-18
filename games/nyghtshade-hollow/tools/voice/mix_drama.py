"""Mix the recorded lines into the dialogue-movie soundtrack (an audio drama that is also the
picture's dialogue track). Ambience and score are synthesized here; nothing is sampled.

usage: python mix_drama.py SCRIPT.json LINESDIR OUT.wav  -> also OUT.timeline.json (start/end of every line)"""
import json, sys, numpy as np, soundfile as sf

SR = 48000
script = json.load(open(sys.argv[1])); ldir = sys.argv[2]; out = sys.argv[3]
rng = np.random.default_rng(7)
lines = {(r['scene'], r['file']): r for r in json.load(open(f'{ldir}/lines.json'))}

def noise(n, lp):                      # one-pole low-passed noise
    x = rng.standard_normal(n); y = np.empty(n); a = np.exp(-2 * np.pi * lp / SR); s = 0.0
    for i in range(0, n, 4096):
        seg = x[i:i+4096]
        import scipy.signal as ss  # noqa
    return x
try:
    import scipy.signal as ss
    def lpn(n, f, order=2): return ss.lfilter(*ss.butter(order, f / (SR / 2)), rng.standard_normal(n))
    def bp(x, lo, hi): return ss.lfilter(*ss.butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band'), x)
    def reverb(x, rt, wet):
        n = int(rt * SR); t = np.arange(n) / SR
        ir = rng.standard_normal(n) * np.exp(-6.9 * t / rt); ir = ss.lfilter(*ss.butter(1, 4000 / (SR / 2)), ir)
        ir /= np.sqrt((ir ** 2).sum())
        return x * (1 - wet) + ss.fftconvolve(x, ir)[:len(x)] * wet
except ImportError:
    sys.exit('needs scipy')

ROOM = {'S1': (2.2, .35), 'S2': (2.2, .3), 'S3': (.5, .12), 'S4': (.25, .05), 'S5': (1.1, .22), 'S6': (.7, .15), 'S7': (.7, .15)}
GAP = {'S4': .35}
segs, timeline, t = [], [], 0.0
for sc in script['scenes']:
    sid = sc['id']; rt, wet = ROOM[sid]; parts = []; n = 0; st = t
    parts.append(np.zeros(int(1.5 * SR)))            # breath before each scene
    t += 1.5
    for row in sc['lines']:
        if row[0] == 'ACTION':
            d = row[2]; parts.append(np.zeros(int(d * SR))); timeline.append({'scene': sid, 'action': row[1], 'start': round(t, 2), 'end': round(t + d, 2)}); t += d; continue
        n += 1
        f = f"lines/{sid}_{n:02d}_{row[0].lower()}.wav"
        a, sr = sf.read(f'{ldir}/{f}'); assert sr == SR
        if row[0] == 'ALLEN': a = bp(a, 300, 3400) * 1.6 + lpn(len(a), 3000) * 0.004
        timeline.append({'scene': sid, 'speaker': row[0], 'text': row[1], 'file': f, 'start': round(t, 2), 'end': round(t + len(a) / SR, 2)})
        gap = GAP.get(sid, 0.55) + (0.25 if len(row[1]) > 60 else 0)
        parts.append(a); parts.append(np.zeros(int(gap * SR))); t += len(a) / SR + gap
    parts.append(np.zeros(int(2.0 * SR))); t += 2.0
    dry = np.concatenate(parts); voice = reverb(dry, rt, wet)
    N = len(voice); amb = np.zeros(N); tt = np.arange(N) / SR
    if sid in ('S1', 'S2'):   # stone under the chapel: low rumble, distant drips
        amb += lpn(N, 120) * 0.02
        for k in rng.uniform(0, N / SR, 6):
            i = int(k * SR); m = min(N - i, 4000); amb[i:i+m] += np.sin(2 * np.pi * 1800 * np.arange(m) / SR) * np.exp(-np.arange(m) / 500) * 0.03
    if sid == 'S3':           # cell block night: fluorescent hum + far noises
        amb += (np.sin(2 * np.pi * 120 * tt) * 0.006 + np.sin(2 * np.pi * 240 * tt) * 0.003) + lpn(N, 400) * 0.01
    if sid == 'S4':           # outdoors, then the ride (second half): wind + engine
        ride = np.clip((tt - timeline[[i for i, x in enumerate(timeline) if x.get('action') and x['scene'] == 'S4'][0]]['start'] + st) / 1.5, 0, 1)
        amb += lpn(N, 600) * (0.02 + 0.06 * ride)
        rpm = 32 + 10 * ride + 3 * np.sin(tt * 0.7)
        ph = np.cumsum(rpm / SR); eng = ((ph % 1) * 2 - 1) * 0.5 + np.sin(2 * np.pi * ph * 2) * 0.4
        amb += ss.lfilter(*ss.butter(2, 400 / (SR / 2)), eng) * 0.12 * ride
    if sid in ('S5', 'S6', 'S7'):  # the chamber: warm low tone; S6 pan sizzle during its action beat
        amb += lpn(N, 200) * 0.012
        if sid == 'S6':
            a0 = [x for x in timeline if x['scene'] == 'S6' and x.get('action')][0]
            i0, i1 = int((a0['start'] - st) * SR), int((a0['end'] - st + 1.5) * SR)
            amb[i0:i1] += bp(rng.standard_normal(i1 - i0), 2500, 9000) * 0.05 * np.minimum(1, np.arange(i1 - i0) / SR / .2)
    # score: slow pad, A minor -> F -> C -> G voicings, very low under dialogue
    chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]]
    ch = chords[int(sid[1]) % 4]; env = np.minimum(1, tt / 3) * np.minimum(1, (N / SR - tt) / 3)
    pad = sum(np.sin(2 * np.pi * f * tt + np.sin(2 * np.pi * .13 * tt)) for f in ch) / 3
    amb += pad * env * 0.025
    segs.append(voice + amb)
mix = np.concatenate(segs)
mix = np.tanh(mix * 1.2) / 1.2
sf.write(out, mix.astype(np.float32), SR)
json.dump(timeline, open(out.rsplit('.', 1)[0] + '.timeline.json', 'w'), indent=1)
print('duration %.1f s' % (len(mix) / SR))
