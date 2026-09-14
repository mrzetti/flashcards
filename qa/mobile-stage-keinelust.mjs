/*
 * Keine Lust is the only SWF that sets Stage.scaleMode = "noScale"
 * (assets/cards/2005-keine-lust/scripts/frame_1/DoAction.as). This script
 * compares the real wrapper at 390x844 with an in-memory patched player.js
 * (scale: 'showAll' + forceScale: true) without touching any file on disk.
 *
 * Usage: node qa/mobile-stage-keinelust.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/root/repos/rammwiki/flashcards/package.json');
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://127.0.0.1:19325';

const RECORDER = `
;(function () {
  function wrap() {
    if (!window.RufflePlayer || typeof window.RufflePlayer.newest !== 'function') { setTimeout(wrap, 5); return; }
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

async function run(browser, { variant, viewportOptions, suffix }) {
  const context = await browser.newContext(viewportOptions);
  await context.route('**/player.js', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    if (variant === 'forcescale') {
      body = body.replace("letterbox: 'on',", "letterbox: 'on', scale: 'showAll', forceScale: true,");
    }
    body += RECORDER;
    await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/javascript; charset=utf-8' }, body });
  });
  const page = await context.newPage();
  const result = { variant, viewport: viewportOptions.viewport };
  try {
    await page.goto(`${BASE}/?card=2005-keine-lust`);
    await page.waitForFunction(() => window.FlashcardsDesktop && window.FlashcardsDesktop.catalogStatus === 'ready');
    await page.waitForSelector('[data-card-id="2005-keine-lust"]');
    await page.click('.details-actions button');
    await page.waitForFunction(() => window.FlashcardsDesktop.player.status === 'playing', null, { timeout: 90000 });
    await page.waitForTimeout(1600);
    const frame = page.frames().find((f) => f.url().includes('player.html') && f.url().includes('2005-keine-lust'));
    result.options = frame ? await frame.evaluate(() => window.__capturedLoadOptions || null) : null;
    result.metrics = frame ? await frame.evaluate(() => {
      const player = document.querySelector('ruffle-player');
      const canvas = player && player.shadowRoot ? player.shadowRoot.querySelector('canvas') : null;
      const r = canvas ? canvas.getBoundingClientRect() : null;
      return {
        viewport: { w: innerWidth, h: innerHeight },
        metadata: player && player.metadata ? { w: player.metadata.width, h: player.metadata.height } : null,
        canvasCss: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      };
    }) : null;

    const stageShot = frame ? await frame.locator('ruffle-player').screenshot() : null;
    if (stageShot) {
      await page.screenshot({ path: path.join(here, `mobile-stage-keine-lust-390${suffix}-page.png`) });
      const dataUrl = 'data:image/png;base64,' + stageShot.toString('base64');
      result.stagePixels = await frame.evaluate(async (url) => {
        const image = new Image();
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
        const c = document.createElement('canvas');
        c.width = image.width; c.height = image.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let minX = c.width, minY = c.height, maxX = -1, maxY = -1, lit = 0;
        for (let y = 0; y < c.height; y += 1) {
          for (let x = 0; x < c.width; x += 1) {
            const i = (y * c.width + x) * 4;
            const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
            if (data[i + 3] > 0 && lum > 32) {
              lit += 1;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        return { w: c.width, h: c.height, minX, minY, maxX, maxY, lit };
      }, dataUrl);
      const { writeFile } = await import('node:fs/promises');
      await writeFile(path.join(here, `mobile-stage-keine-lust-390${suffix}-stage.png`), stageShot);
    }
  } catch (error) {
    result.error = String(error.message || error);
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
  results.push(await run(browser, { variant: 'actual', viewportOptions: mobile, suffix: '' }));
  results.push(await run(browser, { variant: 'forcescale', viewportOptions: mobile, suffix: '-forcescale' }));
  results.push(await run(browser, { variant: 'actual', viewportOptions: desktop, suffix: '-desktop' }));
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
