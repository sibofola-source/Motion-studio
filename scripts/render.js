// node scripts/render.js stills 3.2 7.5 18.6   -> out/still-*.png
// node scripts/render.js frames                -> out/frames/*.jpg (all frames, parallel)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'framework.config.json'), 'utf8'));
const tl = JSON.parse(fs.readFileSync(path.join(root, 'out', 'timeline.json'), 'utf8'));
const url = 'file://' + path.join(root, 'video', 'index.html');
// FORMAT=vertical renders the 1080x1920 reel; default is the 1920x1080 landscape cut
const vertical = process.env.FORMAT === 'vertical';
const layout = vertical ? 'portrait' : 'landscape';
const W = vertical ? 1080 : cfg.width, H = vertical ? 1920 : cfg.height;
const prefix = vertical ? 'vertical-' : '';

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.evaluate(async ([c, t, l]) => { setup(c, t, l); await document.fonts.ready; }, [cfg, tl, layout]);
  return page;
}

(async () => {
  const [mode, ...args] = process.argv.slice(2);
  const browser = await chromium.launch();
  if (mode === 'stills') {
    const page = await openPage(browser);
    for (const s of args) {
      await page.evaluate((t) => renderAt(t), +s);
      const f = path.join(root, 'out', `${prefix}still-${(+s).toFixed(1)}s.png`);
      await page.screenshot({ path: f });
      console.log(f);
    }
  } else {
    const dir = path.join(root, 'out', 'frames');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const total = Math.round(tl.duration * cfg.fps);
    const workers = 4;
    let next = 0, done = 0;
    await Promise.all(Array.from({ length: workers }, async () => {
      const page = await openPage(browser);
      while (next < total) {
        const i = next++;
        await page.evaluate((t) => renderAt(t), i / cfg.fps);
        await page.screenshot({ path: path.join(dir, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 96 });
        if (++done % 60 === 0) console.log(`  ${done}/${total} frames`);
      }
    }));
    console.log(`rendered ${total} frames`);
  }
  await browser.close();
})();
