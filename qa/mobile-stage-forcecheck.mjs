/*
 * Verify whether an in-memory patched player.js actually passes
 * scale/forceScale to Ruffle (no files on disk are modified).
 *
 * Usage: node qa/mobile-stage-forcecheck.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/root/repos/rammwiki/flashcards/package.json');
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://127.0.0.1:19325';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await context.route('**/player.js', async (route) => {
  const response = await route.fetch();
  let body = await response.text();
  const patched = body.includes("letterbox: 'on',");
  body = body.replace("letterbox: 'on',", "letterbox: 'on', scale: 'showAll', forceScale: true,");
  body += `
;(function(){
  function wrap(){
    if (!window.RufflePlayer || typeof window.RufflePlayer.newest !== 'function') { setTimeout(wrap, 5); return; }
    var original = window.RufflePlayer.newest;
    window.RufflePlayer.newest = function(){
      var source = original.apply(this, arguments);
      var create = source.createPlayer;
      source.createPlayer = function(){
        var el = create.apply(this, arguments);
        var ruffle = el.ruffle;
        el.ruffle = function(){
          var api = ruffle.apply(this, arguments);
          var load = api.load;
          api.load = function(options){ window.__capturedLoadOptions = JSON.parse(JSON.stringify(options)); return load.apply(this, arguments); };
          return api;
        };
        return el;
      };
      return source;
    };
  }
  wrap();
})();`;
  console.log('patch matched letterbox string:', patched);
  await route.fulfill({ response, headers: { ...response.headers(), 'content-type': 'application/javascript; charset=utf-8' }, body });
});

try {
  const page = await context.newPage();
  await page.goto(`${BASE}/?card=2004-reise-reise`);
  await page.waitForFunction(() => window.FlashcardsDesktop && window.FlashcardsDesktop.catalogStatus === 'ready');
  await page.waitForSelector('[data-card-id="2004-reise-reise"]');
  await page.click('.details-actions button');
  await page.waitForFunction(() => window.FlashcardsDesktop.player.status === 'playing', null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  const frame = page.frames().find((f) => f.url().includes('player.html') && f.url().includes('2004-reise-reise'));
  const options = frame ? await frame.evaluate(() => window.__capturedLoadOptions || null) : null;
  console.log('captured load options:', JSON.stringify(options, null, 2));
  await page.screenshot({ path: path.join(here, 'mobile-stage-forcecheck.png') });
} finally {
  await context.close();
  await browser.close();
}
