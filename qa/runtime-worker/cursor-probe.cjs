/* Quick checks: Ruffle cursor over labels; positive-control click on 2009-lifad. */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const QA_DIR = path.resolve(__dirname, '..');
const PROBE_JS = fs.readFileSync(path.join(QA_DIR, 'audio-probe.js'), 'utf8');
const BASE = 'https://flashcards.rammwiki.mrzetti.com';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  // --- Rosenrot cursor probe ---
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx1.addInitScript({ content: PROBE_JS });
  const page = await ctx1.newPage();
  await page.goto(`${BASE}/player.html?card=2005-rosenrot`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen, null, { timeout: 120000 });
  await page.waitForTimeout(8000);
  const surface = await page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    const canvas = player.shadowRoot.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const meta = player.ruffle().metadata;
    const scale = Math.min(rect.width / meta.width, rect.height / meta.height);
    return { x: rect.x + (rect.width - meta.width * scale) / 2, y: rect.y + (rect.height - meta.height * scale) / 2, width: meta.width * scale, height: meta.height * scale };
  });
  const canvasCursor = () => page.evaluate(() => {
    const canvas = document.querySelector('ruffle-player').shadowRoot.querySelector('canvas');
    return canvas.style.cursor || getComputedStyle(canvas).cursor;
  });
  await page.mouse.move(640, 418); await page.waitForTimeout(600);
  await page.evaluate(() => {
    const m = document.querySelector('ruffle-player').shadowRoot.querySelector('#hardware-acceleration-modal');
    if (m && !m.classList.contains('hidden')) m.querySelector('.close-modal').click();
  });
  const probes = [[0.09, 0.568, 'deutsch'], [0.09, 0.622, 'english'], [0.5, 0.5, 'center'], [0.5, 0.9, 'bottom'], [0.15, 0.35, 'logo-left']];
  for (const [fx, fy, label] of probes) {
    await page.mouse.move(Math.round(surface.x + fx * surface.width), Math.round(surface.y + fy * surface.height));
    await page.waitForTimeout(500);
    console.log('rosenrot cursor @', label, '=', await canvasCursor());
  }
  const traces = await page.evaluate(() => window.__traces || null);
  console.log('rosenrot traces:', JSON.stringify(traces));
  await ctx1.close();

  // --- LIFAD positive control ---
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx2.addInitScript({ content: PROBE_JS });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/player.html?card=2009-lifad`, { waitUntil: 'domcontentloaded' });
  await page2.waitForFunction(() => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen, null, { timeout: 120000 });
  await page2.waitForTimeout(6000);
  const s2 = await page2.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    const canvas = player.shadowRoot.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const meta = player.ruffle().metadata;
    const scale = Math.min(rect.width / meta.width, rect.height / meta.height);
    return { x: rect.x + (rect.width - meta.width * scale) / 2, y: rect.y + (rect.height - meta.height * scale) / 2, width: meta.width * scale, height: meta.height * scale };
  });
  const outDir = path.join(__dirname, 'out', '_positive');
  fs.mkdirSync(outDir, { recursive: true });
  const clip = { x: Math.floor(s2.x), y: Math.floor(s2.y), width: Math.ceil(s2.width), height: Math.ceil(s2.height) };
  const md5 = (b) => require('crypto').createHash('md5').update(b).digest('hex');
  const shot = async (n) => { const b = await page2.screenshot({ clip }); fs.writeFileSync(path.join(outDir, n), b); return md5(b); };
  const cursor2 = () => page2.evaluate(() => {
    const canvas = document.querySelector('ruffle-player').shadowRoot.querySelector('canvas');
    return canvas.style.cursor || getComputedStyle(canvas).cursor;
  });
  const h0 = await shot('00-base.png');
  for (const [fx, fy, label] of [[0.5, 0.5, 'center'], [0.5, 0.65, 'lower-center'], [0.5, 0.35, 'upper-center']]) {
    const px = Math.round(s2.x + fx * s2.width); const py = Math.round(s2.y + fy * s2.height);
    await page2.mouse.move(px, py);
    await page2.waitForTimeout(600);
    const cur = await cursor2();
    await page2.mouse.down(); await page2.waitForTimeout(90); await page2.mouse.up();
    await page2.waitForTimeout(1500);
    const h = await shot(`10-${label}.png`);
    console.log('lifad', label, 'cursor=', cur, 'changed=', h !== h0);
  }
  await ctx2.close();
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
