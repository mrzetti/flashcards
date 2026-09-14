/*
 * Progress the small "select your language" gate at 390x844.
 *
 * The gate is drawn at native (noScale) size, so its screen position moves
 * with the stage area. This script dismisses Ruffle's hardware-acceleration
 * modal when present and then sweeps a small grid of clicks over the gate
 * region until a language option is hit, then captures the post-gate frame.
 *
 * Usage:
 *   node qa/mobile-stage-progress.mjs            # actual settings
 *   node qa/mobile-stage-progress.mjs forcescale # in-memory patched settings
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/root/repos/rammwiki/flashcards/package.json');
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://127.0.0.1:19325';
const VARIANT = (process.argv[2] || 'actual').toLowerCase();
const SUFFIX = VARIANT === 'forcescale' ? '-forcescale' : '';

const CASES = [
  {
    id: '2004-reise-reise',
    label: 'Reise, Reise',
    // page-coordinate sweep region (390x844 viewport)
    sweep: { x0: 25, x1: 135, y0: 255, y1: 330, step: 9 },
  },
  {
    id: '2005-mann-gegen-mann',
    label: 'Mann gegen Mann',
    sweep: { x0: 45, x1: 110, y0: 355, y1: 400, step: 8 },
  },
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

const browser = await chromium.launch({
  headless: true,
  executablePath: '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

const mobile = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const summary = [];

try {
  for (const item of CASES) {
    const context = await browser.newContext(mobile);
    await installInterceptor(context);
    const page = await context.newPage();
    const record = { card: item.id, variant: VARIANT };
    try {
      await page.goto(`${BASE}/?card=${item.id}`);
      await page.waitForFunction(() => window.FlashcardsDesktop && window.FlashcardsDesktop.catalogStatus === 'ready');
      await page.waitForSelector(`[data-card-id="${item.id}"]`);
      await page.click('.details-actions button');
      await page.waitForFunction(() => window.FlashcardsDesktop.player.status === 'playing', null, { timeout: 90000 });
      await page.waitForTimeout(1500);

      // Dismiss Ruffle's own hardware-acceleration warning if it appeared.
      await page.mouse.click(353, 118);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(here, `mobile-stage-${item.id}-390${SUFFIX}-gate-ready.png`) });

      const { x0, x1, y0, y1, step } = item.sweep;
      let clicks = 0;
      for (let y = y0; y <= y1 && clicks < 130; y += step) {
        for (let x = x0; x <= x1 && clicks < 130; x += step) {
          await page.mouse.click(x, y);
          clicks += 1;
        }
      }
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(here, `mobile-stage-${item.id}-390${SUFFIX}-after-language-sweep.png`) });
      const frame = page.frames().find((f) => f.url().includes('player.html') && f.url().includes(item.id));
      record.options = frame ? await frame.evaluate(() => window.__capturedLoadOptions || null) : null;
      record.metrics = frame ? await frame.evaluate(() => {
        const player = document.querySelector('ruffle-player');
        const canvas = player && player.shadowRoot ? player.shadowRoot.querySelector('canvas') : null;
        const rect = canvas ? canvas.getBoundingClientRect() : null;
        return {
          viewport: { w: innerWidth, h: innerHeight },
          metadata: player && player.metadata ? { w: player.metadata.width, h: player.metadata.height } : null,
          canvasRect: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
        };
      }) : null;
      record.clicks = clicks;
    } catch (error) {
      record.error = String(error.message || error);
      try { await page.screenshot({ path: path.join(here, `mobile-stage-${item.id}-390${SUFFIX}-error.png`) }); } catch (_) { /* ignore */ }
    } finally {
      await context.close();
    }
    summary.push(record);
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(summary, null, 2));
