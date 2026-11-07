// Builds out/timeline.json from framework.config.json.
// If assets/vo.words.json exists (made by scripts/transcribe.py from assets/vo.mp3),
// every scene is timed to the voice. Otherwise scenes are timed to the words on screen.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'framework.config.json'), 'utf8'));
const wordsFile = path.join(root, 'assets', 'vo.words.json');

const count = (s) => (s || '').split(/\s+/).filter(Boolean).length;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const ENDCARD = 2.85; // seconds the end card is held

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const same = (a, b) => a === b || (a.length > 4 && b.length > 4 && lev(a, b) <= 1);

// Times from on-screen text: each beat gets a reading time, then everything is
// scaled to fill the requested duration minus the end card.
function fromText() {
  const beats = [
    { key: 'title', w: 1.6 + (count(cfg.label) + count(cfg.name) + count(cfg.promise)) / 3.0 },
    ...cfg.letters.map((l, i) => ({ key: 'L' + i, w: 0.9 + (count(l.word) + count(l.meaning)) / 3.4 })),
    { key: 'closing', w: 1.8 + count(cfg.closing) / 2.6 },
  ];
  const avail = cfg.duration - ENDCARD;
  const sum = beats.reduce((a, b) => a + b.w, 0);
  let t = 0;
  const at = {};
  for (const b of beats) { at[b.key] = t; t += (b.w / sum) * avail; }
  return { at, duration: cfg.duration, source: 'on-screen text' };
}

// Times from the voice: find each line's anchor word in the Whisper transcript, in order.
function fromVoice(words) {
  const toks = words.map((w) => ({ ...w, n: norm(w.word) })).filter((w) => w.n);
  let cursor = 0;
  const find = (candidates, fallback) => {
    const c = candidates.map(norm).filter(Boolean);
    for (let i = cursor; i < Math.min(toks.length, cursor + 40); i++) {
      if (c.some((x) => same(toks[i].n, x))) { cursor = i + 1; return toks[i].start; }
    }
    console.warn('  could not find', candidates, 'in transcript; estimating');
    return fallback;
  };
  const at = {};
  const firstWords = (s, n = 2) => s.split(/\s+/).slice(0, n);
  at.title = Math.max(0, find(firstWords(cfg.name, 3), 0) - 0.5);
  // step past the rest of the name and the promise so their words can't be mistaken for letters
  for (const w of [...cfg.name.split(/\s+/), ...cfg.promise.split(/\s+/)].map(norm)) {
    for (let i = cursor; i < Math.min(toks.length, cursor + 3); i++) if (same(toks[i].n, w)) { cursor = i + 1; break; }
  }
  let last = at.title + 3;
  cfg.letters.forEach((l, i) => {
    // light the letter when the letter itself, or its word, is spoken (whichever comes first)
    const t = find([l.letter, l.word], last + 2);
    at['L' + i] = t - 0.15; // tiny lead so the light lands on the syllable
    last = t;
  });
  at.closing = find(firstWords(cfg.closing, 2), last + 2.5) - 0.2;
  const voEnd = toks.length ? toks[toks.length - 1].end : at.closing + 2;
  const endStart = Math.max(voEnd + 0.4, at.closing + 1.8);
  return { at, endStart, duration: Math.max(cfg.duration, endStart + ENDCARD), source: 'voiceover' };
}

const hasVO = fs.existsSync(wordsFile);
const r = hasVO ? fromVoice(JSON.parse(fs.readFileSync(wordsFile, 'utf8'))) : fromText();
const { at } = r;
const n = cfg.letters.length;

const tl = {
  source: r.source,
  duration: r.duration,
  label: at.title + 0.25,
  name: at.title + 0.75,
  underline: at.title + 1.55,
  promise: at.title + 2.05,
  titleOut: at.L0 - 1.1,
  rowIn: at.L0 - 0.55,
  letters: cfg.letters.map((_, i) => at['L' + i]),
  sweep: at.closing - 0.9,
  closing: at.closing,
  endCard: r.endStart ?? cfg.duration - ENDCARD,
};
tl.letterOff = tl.letters.map((t, i) => (i + 1 < n ? tl.letters[i + 1] : tl.sweep + 0.3));

fs.mkdirSync(path.join(root, 'out'), { recursive: true });
fs.writeFileSync(path.join(root, 'out', 'timeline.json'), JSON.stringify(tl, null, 2));
console.log(`timeline from ${tl.source}, ${tl.duration.toFixed(2)}s`);
for (const [k, v] of Object.entries(tl)) if (typeof v !== 'string') console.log('  ', k.padEnd(10), Array.isArray(v) ? v.map((x) => x.toFixed(2)).join(', ') : v.toFixed(2));
