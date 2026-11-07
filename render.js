#!/usr/bin/env node
/*
 * Motion-studio renderer.
 *   node render.js <composition>               full MP4 → renders/<name>/<name>.mp4
 *   node render.js <composition> --stills 3    3 PNG stills → renders/<name>/still-N.png
 * Options: --fps 30, --at 2.5,4 (stills at exact seconds), --size 1080x1920 (default 1920x1080)
 *
 * A composition is compositions/<name>/index.html with a 1920x1080 .stage,
 * animated with CSS animations, and `--duration: <seconds>` on :root.
 * Rendering is deterministic: all animations are paused and scrubbed frame by frame.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const name = args.find(a => !a.startsWith('--') && !/^[\d.,x]+$/.test(a));
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
if (!name) { console.error('usage: node render.js <composition> [--stills N] [--at t1,t2] [--fps 30] [--size WxH]'); process.exit(1); }

const htmlPath = path.resolve(__dirname, 'compositions', name, 'index.html');
if (!fs.existsSync(htmlPath)) { console.error('not found: ' + htmlPath); process.exit(1); }
const outDir = path.resolve(__dirname, 'renders', name);
fs.mkdirSync(outDir, { recursive: true });
const fps = Number(opt('fps') || 30);
const [W, H] = (opt('size') || '1920x1080').split('x').map(Number);
const tag = opt('size') ? `-${W}x${H}` : '';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto('file://' + htmlPath + `?size=${W}x${H}`);
  await page.evaluate(() => document.fonts.ready);
  const duration = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration')) || 5);
  await page.evaluate(() => document.getAnimations().forEach(a => a.pause()));
  const seek = t => page.evaluate(ms => document.getAnimations().forEach(a => { a.currentTime = ms; }), t * 1000);
  const stage = await page.$('.stage');

  if (opt('stills') || opt('at')) {
    const n = Number(opt('stills') || 0);
    const times = opt('at') ? opt('at').split(',').map(Number)
      // evenly spaced, ending on the final frame (so the last still shows the end card)
      : Array.from({ length: n }, (_, i) => +(duration * (i + 1) / n - 1 / fps).toFixed(3));
    for (const [i, t] of times.entries()) {
      await seek(t);
      const file = path.join(outDir, `still${tag}-${i + 1}.png`);
      await stage.screenshot({ path: file });
      console.log(`still ${i + 1} @ ${t}s → ${path.relative(__dirname, file)}`);
    }
  } else {
    const file = path.join(outDir, `${name}${tag}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart', file],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = Math.round(duration * fps);
    for (let f = 0; f < total; f++) {
      await seek(f / fps);
      const buf = await stage.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % fps === 0) process.stdout.write(`\rframe ${f}/${total}`);
    }
    ff.stdin.end();
    await new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
    console.log(`\r${total} frames → ${path.relative(__dirname, file)}`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
