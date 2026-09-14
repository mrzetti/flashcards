#!/usr/bin/env node
/*
 * Mouse-technique matrix on specific stage points (e.g. the language gate).
 * Tries hover, click, double-click, press-hold, drag, touch-tap and rapid
 * clicks at each point and records whether the stage changed, plus dialogs,
 * popups, requests and audio.
 *
 * Usage:
 *   node label-matrix.cjs --card 2005-mann-gegen-mann --labels "deutsch:0.194,0.310;english:0.184,0.351"
 *   node label-matrix.cjs --card 2003-lichtspielhaus --labels "order:0.75,0.85;info:0.5,0.15" --settle 4000
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
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

function parseArgs(argv) {
  const out = { settle: 6000 };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    out[key] = (key === 'settle') ? Number(value) : value;
  }
  if (!out.card || !out.labels) throw new Error('need --card and --labels');
  return out;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.join(__dirname, 'out', args.card, 'matrix');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true });
  await context.addInitScript({ content: PROBE_JS });
  const page = await context.newPage();
  const record = { card: args.card, labels: args.labels, settleMs: args.settle, results: [], dialogs: [], popups: [], requests: [], console: [] };
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
  // consume CPU warning once
  await page.mouse.move(640, 418); await page.waitForTimeout(700);
  await page.evaluate(() => {
    const m = document.querySelector('ruffle-player').shadowRoot.getElementById('hardware-acceleration-modal');
    if (m && !m.classList.contains('hidden')) m.querySelector('.close-modal').click();
  });
  await page.mouse.move(4, 870); await page.waitForTimeout(500);

  const labels = args.labels.split(';').map((part) => {
    const [name, coords] = part.split(':');
    const [fx, fy] = coords.split(',').map(Number);
    return { name, fx, fy };
  });

  for (const label of labels) {
    const p = { x: Math.round(surface.x + label.fx * surface.width), y: Math.round(surface.y + label.fy * surface.height) };
    const techniques = [
      ['hover', async () => { await page.mouse.move(p.x, p.y); }],
      ['click', async () => { await page.mouse.move(p.x, p.y); await page.waitForTimeout(200); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); }],
      ['dblclick', async () => { await page.mouse.move(p.x, p.y); await page.waitForTimeout(200); await page.mouse.dblclick(p.x, p.y, { delay: 60 }); }],
      ['hold700', async () => { await page.mouse.move(p.x, p.y); await page.waitForTimeout(200); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up(); }],
      ['drag40', async () => { await page.mouse.move(p.x, p.y); await page.waitForTimeout(200); await page.mouse.down(); await page.mouse.move(p.x + 40, p.y, { steps: 5 }); await page.waitForTimeout(150); await page.mouse.up(); }],
      ['tap', async () => { await page.touchscreen.tap(p.x, p.y); }],
      ['rapid5', async () => { await page.mouse.move(p.x, p.y); for (let i = 0; i < 5; i += 1) { await page.mouse.down(); await page.waitForTimeout(40); await page.mouse.up(); await page.waitForTimeout(110); } }],
    ];
    for (const [name, act] of techniques) {
      const before = await shot(`${label.name}-${name}-before`);
      const requestCount = record.requests.length;
      const dialogCount = record.dialogs.length;
      try { await act(); } catch (error) { record.results.push({ label: label.name, technique: name, error: error.message }); continue; }
      await page.waitForTimeout(1300);
      const after = await shot(`${label.name}-${name}-after`);
      record.results.push({
        label: label.name, technique: name, point: p, changed: after !== before,
        dialogs: record.dialogs.slice(dialogCount), popups: record.popups.slice(),
        newRequests: record.requests.slice(requestCount).map((r) => ({ url: r.url, status: r.status, failure: r.failure, external: r.external })),
        audio: await page.evaluate(() => window.__audioAudit()),
        state: await page.evaluate(() => (window.FlashcardsPlayer ? window.FlashcardsPlayer.state : null)),
      });
      await page.mouse.move(4, 870);
      await page.waitForTimeout(250);
    }
  }
  record.failedRequests = record.requests.filter((r) => r.failure || (r.status && r.status >= 400));
  record.externalRequests = record.requests.filter((r) => r.external);
  fs.writeFileSync(path.join(outDir, 'matrix.json'), JSON.stringify(record, null, 2));
  for (const r of record.results) {
    console.log(`${r.label}/${r.technique}: changed=${r.changed} dialogs=${r.dialogs.length} newRequests=${r.newRequests.length} audioRms=${r.audio && r.audio[0] ? r.audio[0].rms : null}${r.error ? ' error=' + r.error : ''}`);
  }
  if (record.failedRequests.length) console.log('failed:', JSON.stringify(record.failedRequests));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
