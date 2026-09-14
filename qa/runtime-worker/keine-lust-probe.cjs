/* Keine Lust: does the intro loop stop, and do menu clicks work after it? */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const QA_DIR = path.resolve(__dirname, '..');
const PROBE_JS = fs.readFileSync(path.join(QA_DIR, 'audio-probe.js'), 'utf8');
const BASE = 'https://flashcards.rammwiki.mrzetti.com';
const outDir = path.join(__dirname, 'out', '2005-keine-lust', 'long-probe');
fs.mkdirSync(outDir, { recursive: true });
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript({ content: PROBE_JS });
  const page = await context.newPage();
  const record = { dialogs: [], requests: [], console: [], steps: [] };
  page.on('console', (m) => record.console.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => record.console.push('pageerror: ' + e.message));
  page.on('request', (r) => record.requests.push({ url: r.url(), status: null }));
  page.on('response', (r) => { const e = record.requests.findLast((x) => x.url === r.url() && x.status == null); if (e) e.status = r.status(); });
  page.on('requestfailed', (r) => { const e = record.requests.findLast((x) => x.url === r.url() && x.status == null); if (e) e.status = 'FAIL ' + ((r.failure() && r.failure().errorText) || ''); });
  page.on('dialog', async (d) => { record.dialogs.push(d.message()); await d.dismiss().catch(() => {}); });

  await page.goto(`${BASE}/player.html?card=2005-keine-lust`, { waitUntil: 'domcontentloaded' });
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

  // warm-up modal
  const center = pt(0.5, 0.5);
  await page.mouse.move(center.x, center.y); await page.waitForTimeout(700);
  await page.evaluate(() => {
    const m = document.querySelector('ruffle-player').shadowRoot.getElementById('hardware-acceleration-modal');
    if (m && !m.classList.contains('hidden')) m.querySelector('.close-modal').click();
  });
  await page.mouse.move(4, 870); await page.waitForTimeout(400);

  // watch 90s
  let unique = 0; let last = null;
  for (let i = 0; i < 45; i += 1) {
    const h = await page.screenshot({ clip }).then((b) => md5(b));
    if (h !== last) unique += 1;
    last = h;
    await page.waitForTimeout(2000);
  }
  record.watch = { seconds: 90, uniqueFrames: unique };
  await shot('90-watched.png');

  const menu = [['INTRO', 0.211], ['INFO', 0.258], ['WIN', 0.298], ['VIDEO', 0.343], ['TOUR', 0.392], ['SCREENSAVER', 0.463], ['BUY', 0.542]];
  for (const [name, fx] of menu) {
    const p = pt(fx, 0.816);
    const before = await shot(`t-${name}-before.png`);
    const reqCount = record.requests.length; const dlgCount = record.dialogs.length;
    await page.mouse.move(p.x, p.y); await page.waitForTimeout(400);
    await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
    await page.waitForTimeout(2000);
    const after = await shot(`t-${name}-after.png`);
    record.steps.push({ name, changed: after !== before, newDialogs: record.dialogs.slice(dlgCount), newRequests: record.requests.slice(reqCount) });
    await page.mouse.move(4, 870); await page.waitForTimeout(250);
  }
  record.audio = await page.evaluate(() => window.__audioAudit());
  record.state = await page.evaluate(() => window.FlashcardsPlayer.state);
  fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record, null, 2).slice(0, 4000));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
