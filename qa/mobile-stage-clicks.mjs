/*
 * Focused language-gate click + forceScale comparison at 390x844.
 *
 * For Reise, Reise and Mann gegen Mann the SWF renders "select your language"
 * at native size. This script clicks "english" in the real wrapper, and when
 * run with the `forcescale` argument it repeats the run against an in-memory
 * patched player.js (scale: 'showAll' + forceScale: true) without touching
 * any file on disk.
 *
 * Usage:
 *   node qa/mobile-stage-clicks.mjs            # actual load options
 *   node qa/mobile-stage-clicks.mjs forcescale # in-memory patched options
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
  { id: '2004-reise-reise', click: { x: 52, y: 207 }, label: 'Reise, Reise' },
  { id: '2005-mann-gegen-mann', click: { x: 72, y: 378 }, label: 'Mann gegen Mann' },
  { id: '2005-keine-lust', click: null, label: 'Keine Lust' },
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
const results = [];

try {
  // Standalone gate at 390 first (explicit Start card).
  {
    const context = await browser.newContext(mobile);
    await installInterceptor(context);
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/player.html?card=2004-reise-reise`);
      await page.waitForSelector('#start-panel:visible');
      await page.screenshot({ path: path.join(here, `mobile-stage-standalone-gate-390${SUFFIX}.png`) });
      await page.click('#start-card-button');
      await page.waitForFunction(() => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen === true, null, { timeout: 60000 });
      await page.waitForTimeout(1500);
      const options = await page.evaluate(() => window.__capturedLoadOptions || null);
      await page.screenshot({ path: path.join(here, `mobile-stage-standalone-390${SUFFIX}.png`) });
      results.push({ case: 'standalone-gate', card: '2004-reise-reise', variant: VARIANT, options });
    } catch (error) {
      results.push({ case: 'standalone-gate', card: '2004-reise-reise', variant: VARIANT, error: String(error.message || error) });
    } finally {
      await context.close();
    }
  }

  for (const item of CASES) {
    const context = await browser.newContext(mobile);
    await installInterceptor(context);
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/?card=${item.id}`);
      await page.waitForFunction(() => window.FlashcardsDesktop && window.FlashcardsDesktop.catalogStatus === 'ready');
      await page.waitForSelector(`[data-card-id="${item.id}"]`);
      await page.click('.details-actions button');
      await page.waitForFunction(() => window.FlashcardsDesktop.player.status === 'playing', null, { timeout: 90000 });
      await page.waitForTimeout(1500);
      const beforeName = `mobile-stage-${item.id}-390${SUFFIX}-before-click.png`;
      await page.screenshot({ path: path.join(here, beforeName) });
      const options = await page.evaluate(() => {
        const frame = document.querySelector('.player-stage-holder iframe');
        return null;
      });
      const frame = page.frames().find((f) => f.url().includes('player.html') && f.url().includes(item.id));
      const frameOptions = frame ? await frame.evaluate(() => window.__capturedLoadOptions || null) : null;

      let clickResult = 'no-click';
      if (item.click && frame) {
        const iframeBox = await page.locator('.player-stage-holder iframe').boundingBox();
        const targetX = iframeBox.x + item.click.x;
        const targetY = iframeBox.y + item.click.y;
        await page.mouse.click(targetX, targetY);
        clickResult = `${Math.round(targetX)},${Math.round(targetY)}`;
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(here, `mobile-stage-${item.id}-390${SUFFIX}-after-language.png`) });
      }
      results.push({ case: 'embedded', card: item.id, label: item.label, variant: VARIANT, options: frameOptions, click: clickResult, stage: await frame.evaluate(() => {
        const player = document.querySelector('ruffle-player');
        return {
          viewport: { w: innerWidth, h: innerHeight },
          metadata: player && player.metadata ? { w: player.metadata.width, h: player.metadata.height } : null,
        };
      }) });
    } catch (error) {
      results.push({ case: 'embedded', card: item.id, variant: VARIANT, error: String(error.message || error) });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
