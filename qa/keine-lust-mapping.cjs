/*
 * Keine Lust coordinate-mapping probe.
 * Draws DOM markers at the page positions predicted by three possible
 * stage<->page mappings for a known SWF point (the INTRO menu button,
 * SWF coordinates ~ (38, 483.5)), then screenshots the result.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const QA_DIR = __dirname;
const PROBE_JS = fs.readFileSync(path.join(QA_DIR, 'audio-probe.js'), 'utf8');
const BASE = process.env.FLASHCARDS_BASE || 'https://flashcards.rammwiki.mrzetti.com';
const outDir = path.join(QA_DIR, 'runtime-worker', 'out', '2005-keine-lust', 'mapping-probe');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript({ content: PROBE_JS });
  const page = await context.newPage();
  const record = { markers: [], clicks: [] };
  await page.goto(`${BASE}/player.html?card=2005-keine-lust`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen, null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  // consume the CPU warning modal
  await page.mouse.move(640, 418); await page.waitForTimeout(700);
  await page.evaluate(() => {
    const m = document.querySelector('ruffle-player').shadowRoot.getElementById('hardware-acceleration-modal');
    if (m && !m.classList.contains('hidden')) m.querySelector('.close-modal').click();
  });
  await page.mouse.move(4, 870); await page.waitForTimeout(400);

  const geo = await page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    const canvas = player.shadowRoot.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const meta = player.ruffle().metadata;
    const scale = Math.min(rect.width / meta.width, rect.height / meta.height);
    const stage = {
      x: rect.x + (rect.width - meta.width * scale) / 2,
      y: rect.y + (rect.height - meta.height * scale) / 2,
      width: meta.width * scale,
      height: meta.height * scale,
      scale,
      meta: { w: meta.width, h: meta.height },
    };
    return { canvasRect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }, stage };
  });
  record.geo = geo;

  // INTRO button center in SWF px (from XML: place (322,9430) twips + hit 44x24)
  const SWF = { x: 16.1 + 22, y: 471.5 + 12 };

  const mappings = [
    ['A-fit-scale', (p) => ({ x: p.stage.x + SWF.x * p.stage.scale, y: p.stage.y + SWF.y * p.stage.scale })],
    ['B-1to1-centered', () => ({ x: (1280 - 520) / 2 + SWF.x, y: 29 + (777 - 520) / 2 + SWF.y })],
    ['C-1to1-canvas-origin', () => ({ x: 0 + SWF.x, y: 29 + SWF.y })],
  ];
  const overlay = mappings.map(([name, fn], i) => {
    const pos = fn(geo);
    record.markers.push({ name, pos });
    const colors = ['red', 'blue', 'lime'];
    return `<div style="position:fixed;left:${pos.x - 4}px;top:${pos.y - 4}px;width:8px;height:8px;background:${colors[i]};z-index:99999;border:1px solid black"></div>
            <div style="position:fixed;left:${pos.x + 8}px;top:${pos.y - 8}px;color:${colors[i]};font:12px monospace;z-index:99999;text-shadow:0 0 2px black">${name} (${Math.round(pos.x)},${Math.round(pos.y)})</div>`;
  }).join('');
  await page.evaluate((html) => {
    const d = document.createElement('div');
    d.id = 'kl-mapping-overlay';
    d.innerHTML = html;
    document.body.appendChild(d);
  }, overlay);
  await page.screenshot({ path: path.join(outDir, 'mapping-markers.png') });

  // Also probe a click at each mapping and see whether a dialog appears / view changes.
  const fs2 = require('fs');
  for (const [name, fn] of mappings) {
    const pos = fn(geo);
    const before = await page.screenshot({ path: path.join(outDir, `pre-${name}.png`) });
    await page.mouse.move(pos.x, pos.y);
    await page.waitForTimeout(300);
    await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    await page.waitForTimeout(2500);
    const after = await page.screenshot({ path: path.join(outDir, `post-${name}.png`) });
    record.clicks.push({ name, pos, changed: Buffer.compare(before, after) !== 0 });
  }
  fs2.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record, null, 2));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
