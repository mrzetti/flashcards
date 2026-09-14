/*
 * Mobile stage-clipping QA for noScale cards.
 *
 * Investigates whether Keine Lust / Reise, Reise / Rosenrot / Mann gegen Mann
 * are clipped inside the real local wrapper at 127.0.0.1:19325 on a 390x844
 * phone viewport, and whether an alternative Ruffle scale configuration
 * (scale: 'showAll' + forceScale: true) fixes it.
 *
 * player.js is never edited on disk: the script intercepts the served
 * player.js response, appends a load-options recorder, and (in `forcescale`
 * mode) rewrites the load options in memory only.
 *
 * Usage:
 *   node qa/mobile-stage.mjs            # actual settings
 *   node qa/mobile-stage.mjs forcescale # patched settings (in-memory only)
 */
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/root/repos/rammwiki/flashcards/package.json');
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://127.0.0.1:19325';
const VARIANT = (process.argv[2] || process.env.VARIANT || 'actual').toLowerCase();
const CARDS = [
  { id: '2005-keine-lust', label: 'Keine Lust' },
  { id: '2004-reise-reise', label: 'Reise, Reise' },
  { id: '2005-rosenrot', label: 'Rosenrot' },
  { id: '2005-mann-gegen-mann', label: 'Mann gegen Mann' },
];

const RECORDER = `
;(function () {
  function wrap() {
    if (!window.RufflePlayer || typeof window.RufflePlayer.newest !== 'function') {
      setTimeout(wrap, 5);
      return;
    }
    var original = window.RufflePlayer.newest;
    window.RufflePlayer.newest = function () {
      var source = original.apply(this, arguments);
      var create = source.createPlayer;
      source.createPlayer = function () {
        var element = create.apply(this, arguments);
        var ruffle = element.ruffle;
        element.ruffle = function () {
          var api = ruffle.apply(this, arguments);
          var load = api.load;
          api.load = function (options) {
            window.__capturedLoadOptions = JSON.parse(JSON.stringify(options));
            return load.apply(this, arguments);
          };
          return api;
        };
        return element;
      };
      return source;
    };
  }
  wrap();
})();
`;

const STAGE_METRICS = `(() => {
  const player = document.querySelector('ruffle-player');
  const root = player && player.shadowRoot;
  const canvas = root ? root.querySelector('canvas') : null;
  const rect = (element) => {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const canvasRect = rect(canvas);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clipped = Boolean(canvasRect) && (
    canvasRect.x < -1 || canvasRect.y < -1 ||
    canvasRect.x + canvasRect.w > vw + 1 || canvasRect.y + canvasRect.h > vh + 1
  );
  return {
    viewport: { w: vw, h: vh },
    scroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
    metadata: player && player.metadata ? { w: player.metadata.width, h: player.metadata.height } : null,
    readyState: player ? player.readyState : null,
    playerRect: rect(player),
    canvas: canvas ? { attrW: canvas.width, attrH: canvas.height, rect: canvasRect } : null,
    clipped,
    overflowX: canvasRect ? Math.max(0, -(canvasRect.x)) + Math.max(0, canvasRect.x + canvasRect.w - vw) : null,
    overflowY: canvasRect ? Math.max(0, -(canvasRect.y)) + Math.max(0, canvasRect.y + canvasRect.h - vh) : null,
    loadOptions: window.__capturedLoadOptions || null,
  };
})()`;

async function installInterceptor(context) {
  await context.route('**/player.js', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    if (VARIANT === 'forcescale') {
      body = body.replace("letterbox: 'on',", "letterbox: 'on', scale: 'showAll', forceScale: true,");
    }
    body += RECORDER;
    const headers = { ...response.headers(), 'content-type': 'application/javascript; charset=utf-8' };
    await route.fulfill({ response, headers, body });
  });
}

async function waitForPlaying(page, timeout = 90000) {
  await page.waitForFunction(
    () => window.FlashcardsDesktop && window.FlashcardsDesktop.player.status === 'playing',
    null,
    { timeout },
  );
}

async function inspectCard(browser, card, label, viewportOptions, screenshotName, launchMode) {
  const context = await browser.newContext(viewportOptions);
  await installInterceptor(context);
  const page = await context.newPage();
  const result = { card: card.id, label, mode: launchMode, viewport: viewportOptions.viewport, variant: VARIANT };
  try {
    if (launchMode === 'standalone-gate') {
      await page.goto(`${BASE}/player.html?card=${card.id}`);
      await page.waitForSelector('#start-panel:visible');
      await page.screenshot({ path: path.join(here, `${screenshotName}-gate.png`) });
      await page.click('#start-card-button');
    } else {
      await page.goto(`${BASE}/?card=${card.id}`);
      await page.waitForFunction(() => window.FlashcardsDesktop && window.FlashcardsDesktop.catalogStatus === 'ready');
      await page.waitForSelector(`[data-card-id="${card.id}"]`);
      await page.click('.details-actions button');
    }
    await waitForPlaying(page);
    await page.waitForTimeout(1500);
    const frame = page.frames().find((f) => f.url().includes('player.html') && f.url().includes(card.id));
    result.frameUrl = frame ? frame.url() : null;
    result.launchedCard = await page.evaluate(() => window.FlashcardsDesktop.player.cardId);
    result.metrics = frame ? await frame.evaluate(STAGE_METRICS) : null;
    await page.screenshot({ path: path.join(here, `${screenshotName}.png`) });
    const stage = frame ? await frame.locator('ruffle-player') : null;
    if (stage) {
      await stage.screenshot({ path: path.join(here, `${screenshotName}-stage.png`) });
    }
  } catch (error) {
    result.error = error && error.message ? error.message : String(error);
    try { await page.screenshot({ path: path.join(here, `${screenshotName}-error.png`) }); } catch (_) { /* ignore */ }
  } finally {
    await context.close();
  }
  return result;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

const mobile = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const desktop = { viewport: { width: 1280, height: 800 } };
const results = [];

try {
  for (const card of CARDS) {
    const prefix = VARIANT === 'forcescale' ? `mobile-stage-${card.id}-390-forcescale` : `mobile-stage-${card.id}-390`;
    results.push(await inspectCard(browser, card, card.label, mobile, prefix, 'embedded'));
    const desktopPrefix = `mobile-stage-${card.id}-desktop`;
    results.push(await inspectCard(browser, card, card.label, desktop, desktopPrefix, 'embedded'));
  }
  // One standalone-gate check at 390 for the first card.
  results.push(await inspectCard(browser, CARDS[0], CARDS[0].label, mobile, 'mobile-stage-standalone-gate-390', 'standalone-gate'));
} finally {
  await browser.close();
}

const outFile = path.join(here, VARIANT === 'forcescale' ? 'mobile-stage-results-forcescale.json' : 'mobile-stage-results.json');
await writeFile(outFile, JSON.stringify(results, null, 2));
for (const result of results) {
  const metrics = result.metrics || {};
  console.log(
    `${result.variant}\t${result.mode}\t${result.card}\t${result.viewport.width}x${result.viewport.height}\t` +
    `clip=${metrics.clipped}\toverflow=${metrics.overflowX}/${metrics.overflowY}\t` +
    `stage=${metrics.metadata ? metrics.metadata.w + 'x' + metrics.metadata.h : '?'}\tcanvas=${metrics.canvas ? metrics.canvas.rect.w + 'x' + metrics.canvas.rect.h + '@' + metrics.canvas.rect.x + ',' + metrics.canvas.rect.y : '?'}\t` +
    `opts=${metrics.loadOptions ? JSON.stringify({ letterbox: metrics.loadOptions.letterbox, scale: metrics.loadOptions.scale, forceScale: metrics.loadOptions.forceScale, base: metrics.loadOptions.base, autoplay: metrics.loadOptions.autoplay }) : '?'}` +
    (result.error ? `\terror=${result.error}` : ''),
  );
}
console.log('results ->', outFile);
