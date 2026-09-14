/* Targeted click test v3: close Ruffle's hardware-accel modal first, then click label centers. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const QA_DIR = path.resolve(__dirname, '..');
const PROBE_JS = fs.readFileSync(path.join(QA_DIR, 'audio-probe.js'), 'utf8');
const BASE = 'https://flashcards.rammwiki.mrzetti.com';
const outDir = path.join(__dirname, 'out', '_clicktest3');
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

  await page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    window.__traces = [];
    window.__fs = [];
    const r = player.ruffle();
    try { r.traceObserver = (msg) => window.__traces.push(String(msg)); } catch (e) { window.__traces.push('traceObserver error: ' + e.message); }
    try { r.addFSCommandHandler((command, args) => window.__fs.push({ command, args })); } catch (e) { window.__fs.push('fs error: ' + e.message); }
  });

  const getSurface = () => page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    const canvas = player.shadowRoot.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const meta = player.ruffle().metadata;
    const scale = Math.min(rect.width / meta.width, rect.height / meta.height);
    const width = meta.width * scale; const height = meta.height * scale;
    return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
  });
  const dismissModal = async () => {
    const result = await page.evaluate(() => {
      const player = document.querySelector('ruffle-player');
      const modal = player.shadowRoot.querySelector('#hardware-acceleration-modal');
      if (!modal || modal.classList.contains('hidden')) return null;
      const close = modal.querySelector('.close-modal');
      close.click();
      return 'closed';
    });
    return result;
  };

  const surface = await getSurface();
  const clip = { x: Math.floor(surface.x), y: Math.floor(surface.y), width: Math.ceil(surface.width), height: Math.ceil(surface.height) };
  const shot = async (name) => {
    const buf = await page.screenshot({ clip });
    fs.writeFileSync(path.join(outDir, name), buf);
    return md5(buf);
  };
  const pt = (fx, fy) => ({ x: Math.round(surface.x + fx * surface.width), y: Math.round(surface.y + fy * surface.height) });

  await page.waitForTimeout(9000);
  await dismissModal();
  await page.waitForTimeout(1500);
  await dismissModal();
  let base = await shot('00-base.png');

  for (const [fx, fy, label] of [[0.10, 0.605, 'deutsch'], [0.10, 0.659, 'english']]) {
    const p = pt(fx, fy);
    await dismissModal();
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(500);
    const hover = await shot(`10-hover-${label}.png`);
    await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
    await page.waitForTimeout(1800);
    const after = await shot(`11-click-${label}.png`);
    const state = await page.evaluate(() => ({
      traces: window.__traces, fs: window.__fs, state: window.FlashcardsPlayer.state,
      url: location.href,
    }));
    console.log(label, p, 'hoverChanged=' + (hover !== base), 'clickChanged=' + (after !== base), 'afterVsHover=' + (after !== hover));
    console.log(JSON.stringify(state).slice(0, 400));
    base = after;
  }
  console.log('console tail', logs.slice(-4));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
