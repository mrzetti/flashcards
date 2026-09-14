/*
 * Benzin touch/key forwarding diagnosis against the final local wrapper.
 *
 * For each variant: fresh context, load the card, reach gameplay, then run one
 * input path and capture before/after screenshots plus the key-event log.
 * Also records where Ruffle registers its keydown/keyup listeners.
 *
 *   PLAYER_URL=http://127.0.0.1:19325/player.html?card=2005-benzin-game \
 *     node qa/benzin-touch-diagnose.cjs
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const URL = process.env.PLAYER_URL || 'http://127.0.0.1:19325/player.html?card=2005-benzin-game';
const OUT = '/tmp/opencode/benzin-touch-diag';
fs.mkdirSync(OUT, { recursive: true });

const VARIANTS = [
  'real-key',
  'mouse-hold',
  'synth-host',
  'synth-host-focused',
  'synth-container',
  'synth-container-composed',
  'synth-document',
  'synth-window',
  'synth-canvas',
  'synth-window-focused',
  'synth-host-no-focus-blur',
  'synth-host-focus-immediate',
  'synth-host-focus-raf',
];

const INIT = () => {
  window.__keyListeners = [];
  window.__keyEvents = [];
  const orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (type === 'keydown' || type === 'keyup' || type === 'keypress') {
      let label = 'unknown';
      if (this === window) label = 'window';
      else if (this === document) label = 'document';
      else if (this && this.tagName) {
        label = this.tagName.toLowerCase() + (this.id ? '#' + this.id : '') +
          (this.className && typeof this.className === 'string' ? '.' + this.className.trim().split(/\s+/).join('.') : '');
      }
      const capture = typeof options === 'object' && options !== null ? Boolean(options.capture) : Boolean(options);
      window.__keyListeners.push({ type, label, capture });
    }
    return orig.call(this, type, listener, options);
  };
  window.addEventListener('keydown', (e) => {
    window.__keyEvents.push({ type: 'keydown', trusted: e.isTrusted, key: e.key, code: e.code, keyCode: e.keyCode,
      target: e.target && (e.target.tagName + (e.target.id ? '#' + e.target.id : '')), composed: e.composed });
  }, true);
  window.addEventListener('keyup', (e) => {
    window.__keyEvents.push({ type: 'keyup', trusted: e.isTrusted, key: e.key, code: e.code, keyCode: e.keyCode,
      target: e.target && (e.target.tagName + (e.target.id ? '#' + e.target.id : '')), composed: e.composed });
  }, true);
};

async function closeInterferingRuffleUi(page) {
  await page.evaluate(() => {
    const host = document.querySelector('ruffle-player');
    if (!host || !host.shadowRoot) return;
    const sr = host.shadowRoot;
    const modal = sr.querySelector('#hardware-acceleration-modal');
    if (modal) {
      const close = modal.querySelector('.close-modal');
      if (close) close.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      modal.style.display = 'none';
    }
    const overlay = sr.querySelector('#unmute-overlay');
    if (overlay) overlay.style.display = 'none';
  });
  await page.waitForTimeout(400);
}

async function reachGameplay(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const gate = page.getByRole('button', { name: /^Start card$/i });
  if (await gate.count()) await gate.first().click();
  await page.waitForTimeout(9000);
  await closeInterferingRuffleUi(page);
  const click = async (x, y) => { await page.mouse.move(x, y); await page.waitForTimeout(180); await page.mouse.click(x, y, { delay: 120 }); await page.waitForTimeout(800); };
  await click(940, 728); // splash JOUER
  await click(256, 531); // main menu INSTRUCTIONS
  await click(827, 754); // instructions JOUER
  await page.waitForTimeout(2500);
  const touchToggle = page.getByRole('button', { name: /Touch controls/i });
  if (await touchToggle.count() && await page.locator('#touch-controls').isHidden()) {
    await touchToggle.first().click();
    await page.waitForTimeout(300);
  }
}

async function dispatchKey(page, target, type) {
  return page.evaluate(({ target, type }) => {
    const host = document.querySelector('ruffle-player');
    const sr = host && host.shadowRoot;
    let node;
    if (target === 'host') node = host;
    else if (target === 'container') node = sr.querySelector('#container') || sr;
    else if (target === 'canvas') node = sr.querySelector('canvas');
    else if (target === 'document') node = document;
    else node = window;
    const init = {
      key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38,
      bubbles: true, cancelable: true, composed: target === 'container' || target === 'canvas',
      view: window,
    };
    const ev = new KeyboardEvent(type, init);
    node.dispatchEvent(ev);
    return { key: ev.key, code: ev.code, keyCode: ev.keyCode, composed: ev.composed, target };
  }, { target, type });
}

async function runVariant(browser, id) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await context.addInitScript(INIT);
  const page = await context.newPage();
  try {
    await reachGameplay(page);
    await page.screenshot({ path: path.join(OUT, id + '-before.png') });

    if (id === 'real-key') {
      await page.evaluate(() => document.querySelector('ruffle-player').focus({ preventScroll: true }));
      await page.waitForTimeout(200);
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(3000);
      await page.keyboard.up('ArrowUp');
    } else if (id === 'mouse-hold') {
      const box = await page.locator('#touch-controls button', { hasText: /Accelerate/i }).first().boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(100);
      await page.mouse.down();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, id + '-during.png') });
      await page.waitForTimeout(1500);
      await page.mouse.up();
    } else {
      const map = {
        'synth-host': 'host',
        'synth-host-focused': 'host',
        'synth-container': 'container',
        'synth-container-composed': 'container',
        'synth-document': 'document',
        'synth-window': 'window',
        'synth-canvas': 'canvas',
        'synth-window-focused': 'window',
        'synth-host-no-focus-blur': 'host',
        'synth-host-focus-immediate': 'host',
        'synth-host-focus-raf': 'host',
      };
      const target = map[id];
      if (id === 'synth-host-focused' || id === 'synth-window-focused') {
        await page.evaluate(() => document.querySelector('ruffle-player').focus({ preventScroll: true }));
        await page.waitForTimeout(200);
      }
      if (id === 'synth-host-focus-immediate') {
        const r = await page.evaluate(() => {
          const host = document.querySelector('ruffle-player');
          host.focus({ preventScroll: true });
          host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, bubbles: true, cancelable: true }));
          return document.activeElement && document.activeElement.tagName;
        });
        await page.waitForTimeout(3000);
        await page.evaluate(() => {
          const host = document.querySelector('ruffle-player');
          host.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, bubbles: true, cancelable: true }));
        });
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT, id + '-after.png') });
        return { id, focus: { active: r }, keys: await page.evaluate(() => window.__keyEvents), listeners: await page.evaluate(() => window.__keyListeners) };
      }
      if (id === 'synth-host-focus-raf') {
        await page.evaluate(() => new Promise((resolve) => {
          const host = document.querySelector('ruffle-player');
          host.focus({ preventScroll: true });
          requestAnimationFrame(() => {
            host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, bubbles: true, cancelable: true }));
            resolve();
          });
        }));
        await page.waitForTimeout(3000);
        await page.evaluate(() => {
          const host = document.querySelector('ruffle-player');
          host.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, bubbles: true, cancelable: true }));
        });
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT, id + '-after.png') });
        return { id, keys: await page.evaluate(() => window.__keyEvents), listeners: await page.evaluate(() => window.__keyListeners) };
      }
      if (id === 'synth-host-no-focus-blur') {
        await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); document.body.focus && document.body.focus(); });
        await page.waitForTimeout(200);
      }
      const down = await dispatchKey(page, target, 'keydown');
      await page.waitForTimeout(3000);
      const up = await dispatchKey(page, target, 'keyup');
      await page.waitForTimeout(200);
      const info = await page.evaluate(() => ({
        active: document.activeElement && document.activeElement.tagName,
        shadowActive: (() => { try { const a = document.querySelector('ruffle-player').shadowRoot.activeElement; return a ? a.id || a.tagName : null; } catch (e) { return null; } })(),
      }));
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, id + '-after.png') });
      return { id, down, up, focus: info, keys: await page.evaluate(() => window.__keyEvents), listeners: await page.evaluate(() => window.__keyListeners) };
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, id + '-after.png') });
    return {
      id,
      keys: await page.evaluate(() => window.__keyEvents),
      listeners: await page.evaluate(() => window.__keyListeners),
    };
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const results = [];
  try {
    const filter = process.env.VARIANTS ? process.env.VARIANTS.split(',') : null;
    for (const id of (filter || VARIANTS)) {
      process.stdout.write('variant ' + id + ' ... ');
      try {
        const r = await runVariant(browser, id);
        results.push(r);
        console.log('done');
      } catch (e) {
        console.log('FAILED ' + e.message.split('\n')[0]);
        results.push({ id, error: e.message });
      }
    }
  } finally {
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
    await browser.close();
  }
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
