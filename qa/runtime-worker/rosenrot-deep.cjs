/* Deep probe of 2005-rosenrot: traces, animation loop, full-grid clicks, keyboard. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const QA_DIR = path.resolve(__dirname, '..');
const PROBE_JS = fs.readFileSync(path.join(QA_DIR, 'audio-probe.js'), 'utf8');
const BASE = 'https://flashcards.rammwiki.mrzetti.com';
const outDir = path.join(__dirname, 'out', '_rosenrot-deep');
fs.mkdirSync(outDir, { recursive: true });
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript({ content: PROBE_JS });
  await context.addInitScript(() => {
    window.__traces = [];
    const timer = setInterval(() => {
      const player = document.querySelector('ruffle-player');
      if (player && player.ruffle) {
        try {
          player.ruffle().traceObserver = (msg) => window.__traces.push({ t: Date.now(), msg: String(msg) });
          window.__traceHook = true;
          clearInterval(timer);
        } catch (e) { /* not ready */ }
      }
    }, 30);
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/player.html?card=2005-rosenrot`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen, null, { timeout: 120000 });

  const surface = await page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    const canvas = player.shadowRoot.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const meta = player.ruffle().metadata;
    const scale = Math.min(rect.width / meta.width, rect.height / meta.height);
    return { x: rect.x + (rect.width - meta.width * scale) / 2, y: rect.y + (rect.height - meta.height * scale) / 2, width: meta.width * scale, height: meta.height * scale };
  });
  const clip = { x: Math.floor(surface.x), y: Math.floor(surface.y), width: Math.ceil(surface.width), height: Math.ceil(surface.height) };
  const shot = async (n) => { const b = await page.screenshot({ clip }); fs.writeFileSync(path.join(outDir, n), b); return md5(b); };
  const pt = (fx, fy) => ({ x: Math.round(surface.x + fx * surface.width), y: Math.round(surface.y + fy * surface.height) });

  console.log('trace hook installed:', await page.evaluate(() => window.__traceHook || false));
  // animation loop detection: screenshot every 1s for 20s
  const hashes = [];
  for (let i = 0; i < 20; i += 1) {
    hashes.push(await shot(`loop-${String(i).padStart(2, '0')}.png`));
    await page.waitForTimeout(900);
  }
  const unique = new Set(hashes);
  console.log('unique frames over 20s:', unique.size, 'of', hashes.length);
  const traces = await page.evaluate(() => window.__traces.slice(-40));
  console.log('traces:', JSON.stringify(traces));

  // first mouse move + dismiss CPU modal
  await page.mouse.move(640, 418);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const m = document.querySelector('ruffle-player').shadowRoot.querySelector('#hardware-acceleration-modal');
    if (m && !m.classList.contains('hidden')) m.querySelector('.close-modal').click();
  });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(700);

  // full-grid click sweep 8x6
  const before = await shot('grid-base.png');
  const changed = [];
  for (let gy = 0; gy < 6; gy += 1) {
    for (let gx = 0; gx < 8; gx += 1) {
      const fx = 0.06 + gx * 0.125; const fy = 0.08 + gy * 0.168;
      const p = pt(fx, fy);
      await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(120);
      await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up();
      await page.waitForTimeout(320);
      const h = await shot(`grid-${gx}-${gy}.png`);
      if (h !== before) changed.push({ gx, gy, fx: Number(fx.toFixed(3)), fy: Number(fy.toFixed(3)) });
    }
  }
  console.log('grid clicks that changed the stage:', JSON.stringify(changed));
  const afterGrid = await shot('grid-after.png');

  // keyboard: Tab, arrows, Enter, Space
  for (const key of ['Tab', 'Tab', 'Enter', 'Space', 'ArrowLeft', 'ArrowRight']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(600);
  }
  const afterKeys = await shot('keys-after.png');
  console.log('keyboard changed:', afterKeys !== afterGrid);
  const tracesEnd = await page.evaluate(() => window.__traces.slice(-60));
  console.log('traces end:', JSON.stringify(tracesEnd));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
