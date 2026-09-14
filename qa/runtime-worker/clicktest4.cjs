/* Targeted click test v4: trigger+dismiss CPU warning, then click exact label centers. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const QA_DIR = path.resolve(__dirname, '..');
const PROBE_JS = fs.readFileSync(path.join(QA_DIR, 'audio-probe.js'), 'utf8');
const BASE = 'https://flashcards.rammwiki.mrzetti.com';
const outDir = path.join(__dirname, 'out', '_clicktest4');
fs.mkdirSync(outDir, { recursive: true });
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript({ content: PROBE_JS });
  const page = await context.newPage();
  await page.goto(`${BASE}/player.html?card=2005-rosenrot`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen, null, { timeout: 120000 });
  await page.waitForTimeout(8000);

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
  // fy is relative to the *SWF stage* (clip), so pageY = surface.y + fy * surface.height
  const pt = (fx, fy) => ({ x: Math.round(surface.x + fx * surface.width), y: Math.round(surface.y + fy * surface.height) });
  const modalState = () => page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    const m = player.shadowRoot.querySelector('#hardware-acceleration-modal');
    return m ? (m.classList.contains('hidden') ? 'hidden' : 'shown') : 'missing';
  });
  const dismissModal = () => page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    const m = player.shadowRoot.querySelector('#hardware-acceleration-modal');
    if (m && !m.classList.contains('hidden')) { m.querySelector('.close-modal').click(); return true; }
    return false;
  });

  console.log('modal before mouse:', await modalState());
  // first mouse move triggers Ruffle's one-shot CPU warning; dismiss it.
  await page.mouse.move(640, 418);
  await page.waitForTimeout(700);
  console.log('modal after first move:', await modalState());
  console.log('dismissed:', await dismissModal());
  await page.waitForTimeout(500);
  console.log('modal after dismiss:', await modalState());
  // move pointer off the stage, then back later
  await page.mouse.move(5, 5);
  await page.waitForTimeout(600);

  let base = await shot('00-base.png');
  const targets = [
    [0.09, 0.568, 'deutsch'],
    [0.09, 0.622, 'english'],
    [0.09, 0.545, 'select-your-language'],
  ];
  for (const [fx, fy, label] of targets) {
    const p = pt(fx, fy);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(450);
    const hover = await shot(`10-hover-${label}.png`);
    await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
    await page.waitForTimeout(2200);
    const after = await shot(`11-click-${label}.png`);
    const state = await page.evaluate(() => ({ state: window.FlashcardsPlayer.state, audio: window.__audioAudit() }));
    console.log(label, 'page', p, 'hoverChanged=' + (hover !== base), 'clickChanged=' + (after !== base), 'afterVsHover=' + (after !== hover), JSON.stringify(state));
    base = after;
  }
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
