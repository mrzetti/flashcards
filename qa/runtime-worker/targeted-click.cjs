#!/usr/bin/env node
/*
 * Targeted click runner for a single known menu item on a card.
 * Records a before/hover/after screenshot triplet, dialogs, popups,
 * network requests, Ruffle modals and audio around the click.
 *
 * Usage:
 *   node targeted-click.cjs --card 2009-lifad --fx 0.88 --fy 0.92 --label zur-website --settle 25000
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
  const out = { settle: 20000 };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    if (key === 'fx' || key === 'fy' || key === 'settle') out[key] = Number(value);
    else out[key] = value;
  }
  if (!out.card || out.fx == null || out.fy == null) throw new Error('need --card --fx --fy --label');
  out.label = out.label || `${out.fx}-${out.fy}`;
  return out;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.join(__dirname, 'out', args.card, 'targeted');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript({ content: PROBE_JS });
  const page = await context.newPage();
  const record = { card: args.card, fx: args.fx, fy: args.fy, label: args.label, settleMs: args.settle, requests: [], console: [], dialogs: [], popups: [], modals: [] };
  page.on('console', (m) => record.console.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => record.console.push({ type: 'pageerror', text: e.message }));
  page.on('request', (r) => {
    let external = false;
    try { external = new URL(r.url()).host !== BASE_HOST; } catch (e) { external = true; }
    record.requests.push({ url: r.url(), type: r.resourceType(), external, status: null, failure: null });
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
  page.on('dialog', async (d) => {
    record.dialogs.push({ type: d.type(), message: d.message() });
    await d.dismiss().catch(() => {});
  });
  context.on('page', async (p) => {
    record.popups.push(p.url());
    await p.close().catch(() => {});
  });

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
  const p = {
    x: Math.round(surface.x + args.fx * surface.width),
    y: Math.round(surface.y + args.fy * surface.height),
  };
  record.point = p;

  // warm-up: consume CPU warning modal on first mouseover
  await page.mouse.move(640, 418);
  await page.waitForTimeout(700);
  record.cpuWarning = await page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    const m = player.shadowRoot.getElementById('hardware-acceleration-modal');
    if (m && !m.classList.contains('hidden')) { m.querySelector('.close-modal').click(); return true; }
    return false;
  });
  await page.mouse.move(4, 870);
  await page.waitForTimeout(600);

  const before = await shot('00-before');
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(500);
  const hover = await shot('01-hover');
  const requestsBefore = record.requests.length;
  const dialogsBefore = record.dialogs.length;
  await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
  await page.waitForTimeout(1500);
  const after = await shot('02-after');
  record.changed = after !== before;
  record.hoverChanged = hover !== before;
  record.requestsAfterClick = record.requests.slice(requestsBefore).map((r) => ({ url: r.url, status: r.status, failure: r.failure, external: r.external }));
  record.dialogsAfterClick = record.dialogs.slice(dialogsBefore);
  record.modalsAfterClick = await page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    return player && player.shadowRoot
      ? Array.from(player.shadowRoot.querySelectorAll('.modal')).filter((m) => !m.classList.contains('hidden')).map((m) => m.id || '(no id)')
      : [];
  });
  if (record.modalsAfterClick.length) {
    await page.screenshot({ path: path.join(outDir, '03-modal-full.png') });
    await page.evaluate(() => {
      const player = document.querySelector('ruffle-player');
      for (const m of player.shadowRoot.querySelectorAll('.modal:not(.hidden)')) {
        const close = m.querySelector('.close-modal');
        if (close) close.click();
      }
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, '04-modal-closed.png') });
  }
  record.audioAfterClick = await page.evaluate(() => window.__audioAudit());
  record.state = await page.evaluate(() => (window.FlashcardsPlayer ? window.FlashcardsPlayer.state : null));
  record.url = page.url();
  record.externalAfterClick = record.requests.slice(requestsBefore).filter((r) => r.external);
  record.failedAfterClick = record.requests.slice(requestsBefore).filter((r) => r.failure || (r.status && r.status >= 400));
  fs.writeFileSync(path.join(outDir, `${args.label}.json`), JSON.stringify(record, null, 2));
  console.log(JSON.stringify({
    label: args.label, point: p, cssChanged: record.changed, hoverChanged: record.hoverChanged,
    dialogs: record.dialogsAfterClick, popups: record.popups, modals: record.modalsAfterClick,
    requests: record.requestsAfterClick, external: record.externalAfterClick, failed: record.failedAfterClick,
    state: record.state,
  }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
