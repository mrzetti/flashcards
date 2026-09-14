/*
 * One-off runtime probe: inspect the deployed player + Ruffle surface
 * (shadow DOM, exposed JS API, audio analyser) for the first card.
 *
 * Usage: node probe.cjs [cardId]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const QA_DIR = path.resolve(__dirname, '..');
const PROBE_JS = fs.readFileSync(path.join(QA_DIR, 'audio-probe.js'), 'utf8');
const BASE = process.env.FLASHCARDS_BASE || 'https://flashcards.rammwiki.mrzetti.com';
const cardId = process.argv[2] || '2005-rosenrot';
const outDir = path.join(__dirname, 'out', '_probe');

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript({ content: PROBE_JS });
  const page = await context.newPage();
  const consoleLog = [];
  page.on('console', (msg) => consoleLog.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => consoleLog.push(`pageerror: ${err.message}`));

  await page.goto(`${BASE}/player.html?card=${cardId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen,
    null,
    { timeout: 120000 }
  );
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    const player = document.querySelector('.player-stage > *');
    const keys = [];
    if (player) {
      for (const k in player) keys.push(k);
    }
    let ruffleKeys = [];
    let ruffleProto = [];
    let ruffleMethods = {};
    if (player && player.ruffle) {
      const r = player.ruffle();
      ruffleKeys = Object.keys(r);
      ruffleProto = Object.getOwnPropertyNames(Object.getPrototypeOf(r) || {});
      for (const key of ['metadata', 'volume', 'fullscreenEnabled', 'isFullscreen', 'displayRoot', 'traceObserver']) {
        try {
          const v = r[key];
          ruffleMethods[key] = typeof v === 'function' ? '[function]' : (v && typeof v === 'object' ? `[object keys=${Object.keys(v).join('|')}]` : String(v));
        } catch (e) {
          ruffleMethods[key] = 'error: ' + e.message;
        }
      }
    }
    let shadow = null;
    if (player && player.shadowRoot) {
      shadow = Array.from(player.shadowRoot.querySelectorAll('*')).map((el) => ({
        tag: el.tagName,
        id: el.id || '',
        cls: el.className && typeof el.className === 'string' ? el.className.slice(0, 80) : '',
        text: (el.childElementCount === 0 ? (el.textContent || '') : '').trim().slice(0, 80),
      }));
    }
    let a11y = [];
    try {
      a11y = Array.from(document.querySelectorAll('[aria-label], [role]'))
        .filter((el) => !el.closest('.player-toolbar') && !el.closest('.player-header'))
        .map((el) => ({ tag: el.tagName, role: el.getAttribute('role'), label: el.getAttribute('aria-label'), text: (el.textContent || '').trim().slice(0, 60), hidden: el.hidden }));
    } catch (e) { a11y = ['error: ' + e.message]; }
    return {
      ua: navigator.userAgent,
      state: window.FlashcardsPlayer.state,
      playerTag: player ? player.tagName : null,
      playerKeys: keys.slice(0, 80),
      ruffleKeys,
      ruffleProto,
      ruffleMethods,
      shadow,
      a11y,
      status: document.getElementById('toolbar-status').textContent,
      title: document.getElementById('player-title').textContent,
      notes: document.getElementById('player-notes').textContent.slice(0, 500),
    };
  });
  const audio = await page.evaluate(() => (window.__audioAudit ? window.__audioAudit() : 'missing'));
  await page.screenshot({ path: path.join(outDir, `${cardId}-probe.png`), fullPage: false });
  fs.writeFileSync(path.join(outDir, 'probe-info.json'), JSON.stringify({ info, audio, consoleLog }, null, 2));
  console.log(JSON.stringify({ info, audio, consoleLog }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error('PROBE FAILED', error);
  process.exit(1);
});
