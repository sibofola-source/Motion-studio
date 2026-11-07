"""Builds out/mix.wav: music bed + soft pops on each letter + hit & shimmer on the closing line.
Uses assets/music.mp3 as the bed if present, otherwise synthesises one. If assets/vo.mp3 is
present it's mixed in and the music ducks under the voice."""
import json, os, subprocess, wave
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..')
SR = 48000
TL = json.load(open(os.path.join(ROOT, 'out', 'timeline.json')))
DUR = TL['duration']
N = int(DUR * SR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def fit(x):
    out = np.zeros((N, 2), np.float32)
    out[:min(N, len(x))] = x[:N]
    return out


def lp_fast(x, fc):
    # cheap low-pass: three cascaded moving averages
    k = max(1, int(SR / (fc * 2.2)))
    ker = np.ones(k) / k
    for _ in range(3):
        x = np.convolve(x, ker, mode='same')
    return x


def reverb(x, mix=0.35):
    # small Schroeder-style reverb: parallel combs + allpass, per channel with offsets
    out = np.zeros_like(x)
    for ch, off in ((0, 0), (1, 37)):
        sig = x[:, ch]
        acc = np.zeros(len(sig))
        for d, g in ((1557, .84), (1617, .83), (1491, .85), (1422, .86), (1277, .87), (1356, .86)):
            d = int((d + off) * SR / 44100)
            # comb filter computed block-wise using delay lines
            buf = np.zeros(len(sig) + d)
            for start in range(0, len(sig), d):
                end = min(len(sig), start + d)
                buf[start + d:end + d] = sig[start:end] + g * buf[start:end]
            acc += buf[d:d + len(sig)]
        out[:, ch] = acc / 6
    out = np.stack([lp_fast(out[:, 0], 5000), lp_fast(out[:, 1], 5000)], 1)
    return x * (1 - mix) + out * mix


def note_hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def music_bed():
    bpm = 72; beat = 60 / bpm; bar = beat * 4
    # Dmaj9 – Bm11 – Gmaj7(#11) – A6sus  (warm, hopeful, unhurried)
    chords = [[50, 57, 61, 64, 66], [47, 54, 57, 61, 64], [43, 50, 54, 59, 61], [45, 52, 54, 57, 62]]
    out = np.zeros((N, 2))
    nb = int(np.ceil(DUR / bar)) + 1
    for b in range(nb):
        ch = chords[b % 4]; t0 = b * bar
        i0 = int(t0 * SR); i1 = min(N, int((t0 + bar + 1.5) * SR))
        if i0 >= N: break
        tt = np.arange(i1 - i0) / SR
        env = np.clip(tt / 1.4, 0, 1) * np.clip((bar + 1.5 - tt) / 1.5, 0, 1)
        env = env ** 1.5
        for k, m in enumerate(ch):
            f = note_hz(m + 12 * (k == 0 and 0))
            for det, pan in ((-.11, .3), (.13, .7)):
                ff = f * 2 ** (det / 12 * .5)
                wave_ = np.sin(2 * np.pi * ff * tt) + .18 * np.sin(4 * np.pi * ff * tt) + .06 * np.sin(6 * np.pi * ff * tt)
                g = (.5 if k == 0 else .22) * env
                out[i0:i1, 0] += wave_ * g * (1 - pan)
                out[i0:i1, 1] += wave_ * g * pan
        # soft sub on the root
        out[i0:i1] += (np.sin(2 * np.pi * note_hz(ch[0] - 12) * tt) * env * .35)[:, None]
    # gentle bell arpeggio in eighths
    arp_pat = [0, 2, 3, 4, 3, 2, 4, 1]
    step = beat / 2
    for s in range(int(DUR / step)):
        t0 = s * step
        ch = chords[int(t0 // bar) % 4]
        m = ch[arp_pat[s % 8] % len(ch)] + 24
        i0 = int(t0 * SR); L = int(1.6 * SR); i1 = min(N, i0 + L)
        tt = np.arange(i1 - i0) / SR
        f = note_hz(m)
        bell = (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * f * 2.01 * tt) * np.exp(-tt * 6)) * np.exp(-tt * 3.2)
        bell *= np.clip(tt / .004, 0, 1)
        vel = .16 * (1 if s % 2 == 0 else .7)
        pan = .5 + .3 * np.sin(s * 1.3)
        out[i0:i1, 0] += bell * vel * (1 - pan); out[i0:i1, 1] += bell * vel * pan
    out = np.stack([lp_fast(out[:, 0], 6500), lp_fast(out[:, 1], 6500)], 1)
    out = reverb(out, .4)
    return out / (np.abs(out).max() + 1e-9) * .5


def pop(at, pitch=1.0):
    L = int(.35 * SR); tt = np.arange(L) / SR
    f = (720 * np.exp(-tt * 30) + 520) * pitch
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-tt * 22) * np.clip(tt / .002, 0, 1)
    click = lp_fast(rng.standard_normal(L), 4000) * np.exp(-tt * 300) * .5
    air = np.sin(2 * ph * 2.0) * np.exp(-tt * 40) * .15
    s = (body + click + air) * .55
    return at, np.stack([s, s], 1)


def hit(at):
    L = int(2.4 * SR); tt = np.arange(L) / SR
    boom = np.sin(2 * np.pi * (48 + 60 * np.exp(-tt * 18)) * tt) * np.exp(-tt * 2.6)
    noise = lp_fast(rng.standard_normal(L), 1400) * np.exp(-tt * 7) * 1.6
    s = (boom * .9 + noise * .5) * np.clip(tt / .003, 0, 1)
    return at, np.stack([s, s], 1) * .9


def shimmer(at):
    L = int(3.2 * SR); tt = np.arange(L) / SR
    out = np.zeros((L, 2))
    notes = [86, 90, 93, 97, 98, 102]  # high D-major sparkle, rising
    for k, m in enumerate(notes):
        d = k * .07; i0 = int(d * SR); t2 = tt[:L - i0]
        f = note_hz(m)
        s = np.sin(2 * np.pi * f * t2) * np.exp(-t2 * 2.2) * (1 + .3 * np.sin(2 * np.pi * 7 * t2)) * np.clip(t2 / .01, 0, 1)
        pan = .2 + .6 * (k / (len(notes) - 1))
        out[i0:, 0] += s * (1 - pan) * .22; out[i0:, 1] += s * pan * .22
    sw = rng.standard_normal(L)
    sw = (lp_fast(sw, 9000) - lp_fast(sw, 3500)) * np.exp(-tt * 4.5) * np.clip(tt / .25, 0, 1) * .035
    out += sw[:, None]
    return at, out


def place(buf, ev, gain=1.0):
    at, s = ev
    i0 = int(at * SR)
    if i0 >= N: return
    n = min(len(s), N - i0)
    buf[i0:i0 + n] += s[:n] * gain


music_path = os.path.join(ROOT, 'assets', 'music.mp3')
vo_path = os.path.join(ROOT, 'assets', 'vo.mp3')
music = fit(load(music_path)) if os.path.exists(music_path) else fit(music_bed())
if os.path.exists(music_path):
    music *= .5 / (np.abs(music).max() + 1e-9)

# music fades in/out
fade = np.clip(t_all / 1.5, 0, 1) * np.clip((DUR - t_all) / 1.2, 0, 1)
gain = fade * 0.55

vo = None
if os.path.exists(vo_path):
    vo = fit(load(vo_path))
    # duck: smoothed voice envelope pulls music down ~10 dB while speaking
    env = np.abs(vo).mean(1)
    env = lp_fast(env, 3)
    speaking = np.clip(env / (env.max() * .08 + 1e-9), 0, 1)
    speaking = lp_fast(speaking, 2)
    gain = gain * (1 - .68 * speaking)

mix = music * gain[:, None]
fx = np.zeros((N, 2))
for i, t in enumerate(TL['letters']):
    place(fx, pop(t, 1.0 + .06 * i), .65)
place(fx, hit(TL['closing']), .7)
place(fx, shimmer(TL['closing'] + .02), 1.0)
place(fx, pop(TL['endCard'] + .1, .7), .25)
fx = reverb(fx, .25)
mix += fx
if vo is not None:
    mix += vo * 1.0

mix = np.tanh(mix * 1.1) / np.tanh(1.1)  # gentle soft-clip
mix *= .89 / (np.abs(mix).max() + 1e-9)
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
with wave.open(os.path.join(ROOT, 'out', 'mix.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote out/mix.wav', f'{DUR:.2f}s', 'music:', 'assets/music.mp3' if os.path.exists(music_path) else 'synth',
      '| vo:', 'yes (ducked)' if vo is not None else 'none')
