#!/usr/bin/env node
/**
 * LIFAD wordmark render test.
 *
 * Loads originals/2009-lifad.swf and the compatibility-patched copy
 * (assets/cards/2009-lifad/2009-lifad-ruffle-compat.swf) in the isolated
 * patches/lifad/harness.html page with the project's self-hosted Ruffle, then
 * screenshots the final frame and measures how much of the logo band is gold.
 *
 * Ruffle bug (ruffle-rs/ruffle#23630): the nine clip-depth masks inside
 * DefineSprite 48 are ignored, so the animated gold gradient bars render as
 * solid rectangles. The patched SWF uses MovieClip.setMask() instead and
 * renders the real RAMMSTEIN lettering.
 *
 * Assertions (logo band of the 800x585 stage):
 *   original -> 0 background pixels enclosed above and below by gold (solid bars)
 *   patched  -> >100 enclosed background pixels (glyph counters and notches)
 *
 * Usage:  LIFAD_BASE=http://127.0.0.1:19325 node qa/lifad-render-test.cjs
 * Needs:  python3 -m http.server 19325 --bind 127.0.0.1 \
 *           --directory /root/repos/rammwiki/flashcards
 * Output: qa/lifad-evidence/ (screenshots + render-results.json)
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.LIFAD_BASE || 'http://127.0.0.1:19325';
const out = process.env.LIFAD_OUT || path.join(__dirname, 'lifad-evidence');
fs.mkdirSync(out, { recursive: true });

const variants = [
  { name: 'original', swf: '/originals/2009-lifad.swf', expect: 'blocky' },
  { name: 'patched', swf: '/assets/cards/2009-lifad/2009-lifad-ruffle-compat.swf', expect: 'glyphs' },
];

async function goldRatio(browser, pngPath) {
  const dataUrl = 'data:image/png;base64,' + fs.readFileSync(pngPath).toString('base64');
  const page = await browser.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  const result = await page.evaluate(async (src) => {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = src; });
    const canvas = document.getElementById('c');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    // Logo band of the 800x585 stage: y ~ 18..94 -> 3%..16% of height.
    const y0 = Math.round(img.height * 0.03);
    const y1 = Math.round(img.height * 0.16);
    const w = img.width;
    const h = y1 - y0;
    const d = ctx.getImageData(0, y0, w, h).data;
    const gold = [];
    let goldPixels = 0;
    for (let y = 0; y < h; y++) {
      gold[y] = [];
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const isGold = r > 120 && g > 90 && b < 140 && r > b + 40;
        gold[y][x] = isGold ? 1 : 0;
        if (isGold) goldPixels++;
      }
    }
    let dark = 0;
    let enclosedDark = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (gold[y][x]) continue;
        dark++;
        let up = false;
        let down = false;
        for (let k = 1; k <= 22 && y - k >= 0; k++) if (gold[y - k][x]) { up = true; break; }
        for (let k = 1; k <= 22 && y + k < h; k++) if (gold[y + k][x]) { down = true; break; }
        if (up && down) enclosedDark++;
      }
    }
    return {
      width: img.width,
      height: img.height,
      goldRatio: +(goldPixels / (w * h)).toFixed(4),
      darkPixels: dark,
      enclosedDark,
    };
  }, dataUrl);
  await page.close();
  return result;
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const results = [];
  for (const variant of variants) {
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const page = await context.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
    page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
    const url = `${base}/patches/lifad/harness.html?swf=${encodeURIComponent(variant.swf)}`;
    await page.goto(url);
    await page.waitForFunction(
      () => window.__status === 'loaded' || String(window.__status).includes('error'),
      null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(11000); // wordmark build-up
    await page.locator('#player').screenshot({ path: path.join(out, `lifad-${variant.name}-mid.png`) });
    await page.waitForTimeout(5000); // 202 frames @ 30 fps + load gates
    const status = await page.evaluate(() => window.__status);
    const png = path.join(out, `lifad-${variant.name}.png`);
    await page.locator('#player').screenshot({ path: png });
    const metrics = await goldRatio(browser, png);
    results.push({ variant: variant.name, swf: variant.swf, status, expect: variant.expect, ...metrics, logs: logs.slice(0, 40) });
    await context.close();
  }
  fs.writeFileSync(path.join(out, 'render-results.json'), JSON.stringify(results, null, 2));
  await browser.close();
  let failed = false;
  for (const r of results) {
    console.log(JSON.stringify(r, null, 2));
    if (r.status !== 'loaded') failed = true;
    if (r.expect === 'blocky' && r.enclosedDark !== 0) failed = true;
    if (r.expect === 'glyphs' && r.enclosedDark < 100) failed = true;
  }
  if (failed) {
    console.error('LIFAD render test FAILED');
    process.exit(1);
  }
  console.log('LIFAD render test PASSED');
})();
