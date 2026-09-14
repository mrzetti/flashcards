/* Targeted click test v2: wait out the intro scramble, then click precise label centers. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const QA_DIR = path.resolve(__dirname, '..');
const PROBE_JS = fs.readFileSync(path.join(QA_DIR, 'audio-probe.js'), 'utf8');
const BASE = 'https://flashcards.rammwiki.mrzetti.com';
const outDir = path.join(__dirname, 'out', '_clicktest2');
fs.mkdirSync(outDir, { recursive: true });
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript({ content: PROBE_JS });
  const page = await context.newPage();
  await page.goto(`${BASE}/player.html?card=2005-rosenrot`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen, null, { timeout: 120000 });

  const surface = await page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    const canvas = player.shadowRoot.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const meta = player.ruffle().metadata;
    const scale = Math.min(rect.width / meta.width, rect.height / meta.height);
    const width = meta.width * scale; const height = meta.height * scale;
    return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
  });
  const clip = { x: Math.floor(surface.x), y: Math.floor(surface.y), width: Math.ceil(surface.width), height: Math.ceil(surface.height) };
  const shot = async (name) => {
    const buf = await page.screenshot({ clip });
    fs.writeFileSync(path.join(outDir, name), buf);
    return md5(buf);
  };
  const pt = (fx, fy) => ({ x: Math.round(surface.x + fx * surface.width), y: Math.round(surface.y + fy * surface.height) });

  // Watch the intro until it stops changing (max 40s).
  let last = null; let stableAt = null;
  for (let i = 0; i < 20; i += 1) {
    const h = await shot(`stab-${String(i).padStart(2, '0')}.png`);
    if (h === last) { stableAt = i; break; }
    last = h;
    await page.waitForTimeout(2000);
  }
  console.log('stable at iteration', stableAt, '(2s per iteration after metadata)');

  let base = await shot('20-base.png');
  const clicks = [[0.09, 0.66, 'deutsch'], [0.09, 0.74, 'english'], [0.09, 0.70, 'between'], [0.5, 0.5, 'center']];
  for (const [fx, fy, label] of clicks) {
    const p = pt(fx, fy);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(400);
    await page.mouse.move(p.x, p.y); // second move to ensure rollover
    await page.waitForTimeout(200);
    const hover = await shot(`21-hover-${label}.png`);
    await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    await page.waitForTimeout(1500);
    const after = await shot(`22-after-${label}.png`);
    const state = await page.evaluate(() => window.FlashcardsPlayer.state);
    console.log(label, p, 'hoverChanged=' + (hover !== base), 'clickChanged=' + (after !== base), 'afterVsHover=' + (after !== hover), JSON.stringify(state));
    base = after;
  }
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
