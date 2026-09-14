#!/usr/bin/env node
/*
 * Click a sequence of stage points with waits/change detection.
 * Usage:
 *   node sequence-click.cjs --card 2005-mann-gegen-mann \
 *     --steps "deutsch:0.194,0.310:5000;INFO:0.93,0.435:3000;VIDEO:0.93,0.466:3000"
 * Each step: label:fx,fy:waitMsAfterClick
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const QA_DIR = path.resolve(__dirname, '..');
const PROBE_JS = fs.readFileSync(path.join(QA_DIR, 'audio-probe.js'), 'utf8');
const BASE = process.env.FLASHCARDS_BASE || 'https://flashcards.rammwiki.mrzetti.com';
const BASE_HOST = new URL(BASE).host;
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

function parseArgs(argv) {
  const out = { settle: 6000 };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    out[key] = key === 'settle' || key === 'minRms' ? Number(value) : value;
  }
  if (!out.card || !out.steps || !out.tag) throw new Error('need --card --steps --tag');
  return out;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.join(__dirname, 'out', args.card, 'sequence');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript({ content: PROBE_JS });
  const page = await context.newPage();
  const record = { card: args.card, tag: args.tag, steps: [], dialogs: [], popups: [], requests: [], console: [] };
  page.on('console', (m) => record.console.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => record.console.push({ type: 'pageerror', text: e.message }));
  page.on('request', (r) => {
    let external = false;
    try { external = new URL(r.url()).host !== BASE_HOST; } catch (e) { external = true; }
    record.requests.push({ url: r.url(), external, status: null, failure: null });
  });
  page.on('response', (r) => {
    for (let i = record.requests.length - 1; i >= 0; i -= 1) {
      if (record.requests[i].url === r.url() && record.requests[i].status == null && !record.requests[i].failure) {
        record.requests[i].status = r.status(); break;
      }
    }
  });
  page.on('requestfailed', (r) => {
    for (let i = record.requests.length - 1; i >= 0; i -= 1) {
      if (record.requests[i].url === r.url() && record.requests[i].status == null && !record.requests[i].failure) {
        record.requests[i].failure = (r.failure() && r.failure().errorText) || 'failed'; break;
      }
    }
  });
  page.on('dialog', async (d) => { record.dialogs.push({ type: d.type(), message: d.message() }); await d.dismiss().catch(() => {}); });
  context.on('page', async (p) => { record.popups.push(p.url()); await p.close().catch(() => {}); });

  await page.goto(`${BASE}/player.html?card=${args.card}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen, null, { timeout: 120000 });
  await page.waitForTimeout(args.settle);
  const surface = await page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    const canvas = player.shadowRoot.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const meta = player.ruffle().metadata;
    const scale = Math.min(rect.width / meta.width, rect.height / meta.height);
    return { x: rect.x + (rect.width - meta.width * scale) / 2, y: rect.y + (rect.height - meta.height * scale) / 2, width: meta.width * scale, height: meta.height * scale };
  });
  const clip = { x: Math.floor(surface.x), y: Math.floor(surface.y), width: Math.ceil(surface.width), height: Math.ceil(surface.height) };
  const shot = async (name) => {
    const buf = await page.screenshot({ clip });
    fs.writeFileSync(path.join(outDir, `${name}.png`), buf);
    return md5(buf);
  };
  const pt = (fx, fy) => ({ x: Math.round(surface.x + fx * surface.width), y: Math.round(surface.y + fy * surface.height) });

  // warm-up CPU modal
  await page.mouse.move(640, 418); await page.waitForTimeout(700);
  await page.evaluate(() => {
    const m = document.querySelector('ruffle-player').shadowRoot.getElementById('hardware-acceleration-modal');
    if (m && !m.classList.contains('hidden')) m.querySelector('.close-modal').click();
  });
  await page.mouse.move(4, 870); await page.waitForTimeout(500);

  let stepIndex = 0;
  for (const spec of args.steps.split(';')) {
    stepIndex += 1;
    const [label, coords, waitMs] = spec.split(':');
    const [fx, fy] = coords.split(',').map(Number);
    const p = pt(fx, fy);
    const before = await shot(`step${stepIndex}-${label}-before`);
    const requestCount = record.requests.length; const dialogCount = record.dialogs.length; const consoleCount = record.console.length;
    await page.mouse.move(p.x, p.y); await page.waitForTimeout(400);
    await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
    await page.waitForTimeout(Number(waitMs) || 2500);
    const after = await shot(`step${stepIndex}-${label}-after`);
    const audio = await page.evaluate(() => window.__audioAudit());
    const rms = (audio && audio[0] && typeof audio[0].rms === 'number') ? audio[0].rms : null;
    record.steps.push({
      index: stepIndex, label, fx, fy, point: p,
      changed: after !== before,
      dialogs: record.dialogs.slice(dialogCount),
      newRequests: record.requests.slice(requestCount).map((r) => ({ url: r.url, status: r.status, failure: r.failure, external: r.external })),
      newConsole: record.console.slice(consoleCount),
      audioRms: rms,
      state: await page.evaluate(() => (window.FlashcardsPlayer ? window.FlashcardsPlayer.state : null)),
    });
    await page.mouse.move(4, 870);
    await page.waitForTimeout(250);
  }
  record.failedRequests = record.requests.filter((r) => r.failure || (r.status && r.status >= 400));
  record.externalRequests = record.requests.filter((r) => r.external);
  fs.writeFileSync(path.join(outDir, `${args.tag}.json`), JSON.stringify(record, null, 2));
  for (const s of record.steps) {
    console.log(`${s.label}: changed=${s.changed} dialogs=${JSON.stringify(s.dialogs)} reqs=${JSON.stringify(s.newRequests)} audioRms=${s.audioRms}`);
  }
  console.log('all dialogs:', JSON.stringify(record.dialogs));
  console.log('failed:', JSON.stringify(record.failedRequests));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
