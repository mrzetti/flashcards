/* Targeted click test: does a click on a visible menu label change the frame? */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const QA_DIR = path.resolve(__dirname, '..');
const PROBE_JS = fs.readFileSync(path.join(QA_DIR, 'audio-probe.js'), 'utf8');
const BASE = 'https://flashcards.rammwiki.mrzetti.com';
const outDir = path.join(__dirname, 'out', '_clicktest');
fs.mkdirSync(outDir, { recursive: true });

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript({ content: PROBE_JS });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  await page.goto(`${BASE}/player.html?card=2005-rosenrot`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen, null, { timeout: 120000 });
  await page.waitForTimeout(5000);

  const surface = await page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    const root = player.shadowRoot;
    const canvas = root.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const meta = player.ruffle().metadata;
    const scale = Math.min(rect.width / meta.width, rect.height / meta.height);
    const width = meta.width * scale; const height = meta.height * scale;
    const overlay = root.querySelector('#unmute-overlay');
    return {
      content: { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height },
      overlay: overlay ? { hidden: overlay.hidden, display: getComputedStyle(overlay).display, pointerEvents: getComputedStyle(overlay).pointerEvents } : null,
      canvasPointerEvents: getComputedStyle(canvas).pointerEvents,
    };
  });
  console.log('surface', JSON.stringify(surface));
  const clip = {
    x: Math.floor(surface.content.x), y: Math.floor(surface.content.y),
    width: Math.ceil(surface.content.width), height: Math.ceil(surface.content.height),
  };
  const shot = async (name) => {
    const buf = await page.screenshot({ clip });
    fs.writeFileSync(path.join(outDir, name), buf);
    return md5(buf);
  };
  const point = (fx, fy) => ({
    x: Math.round(surface.content.x + fx * surface.content.width),
    y: Math.round(surface.content.y + fy * surface.content.height),
  });

  const h0 = await shot('00-base.png');
  for (const [fx, fy, label] of [[0.10, 0.64, 'deutsch'], [0.10, 0.74, 'english'], [0.5, 0.5, 'center']]) {
    const p = point(fx, fy);
    const element = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      const player = document.querySelector('ruffle-player');
      const inner = player.shadowRoot.elementFromPoint ? player.shadowRoot.elementFromPoint(x, y) : null;
      return { page: el && el.tagName + '.' + el.className, shadow: inner && inner.tagName + '#' + (inner.id || '') };
    }, p);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(300);
    const hHover = await shot(`10-hover-${label}.png`);
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    await page.waitForTimeout(1200);
    const hClick = await shot(`11-click-${label}.png`);
    const audio = await page.evaluate(() => window.__audioAudit());
    console.log(label, p, JSON.stringify(element), 'hoverChanged=' + (hHover !== h0), 'clickChanged=' + (hClick !== h0), 'clickVsHover=' + (hClick !== hHover), 'audio=', JSON.stringify(audio));
  }
  console.log('logs', logs.slice(-5));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
