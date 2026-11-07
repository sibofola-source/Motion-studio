// Render brand-check/index.html to brand-check/brand-check.mp4 (5 s, 30 fps, 1920x1080)
// and a still at 4.5 s to brand-check/still.png.  Usage: node brand-check/render.js
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const FPS = 30, DUR = 5, dir = __dirname;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.join(dir, 'index.html'));
  await page.evaluate(() => document.fonts.ready);

  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
    path.join(dir, 'brand-check.mp4')], { stdio: ['pipe', 'ignore', 'inherit'] });

  for (let f = 0; f < FPS * DUR; f++) {
    await page.evaluate(t => window.seek(t), f / FPS);
    ff.stdin.write(await page.screenshot({ type: 'png' }));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));

  await page.evaluate(() => window.seek(4.5));
  await page.screenshot({ path: path.join(dir, 'still.png') });
  await browser.close();
})();
