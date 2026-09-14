/*
 * Benzin input-path probe on the locally served player page.
 * Compares:
 *   A) real keyboard (expected to fail because player.js focuses during loadedmetadata)
 *   B) synthetic KeyboardEvent at the <ruffle-player> host (what player.js touch controls do)
 *   C) synthetic KeyboardEvent at the shadow #container with composed:true
 *   D) the actual touch-control button (pointer hold), when present
 *
 *   node benzin-input-paths.cjs
 */
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = '/tmp/opencode/benzin-paths';
fs.mkdirSync(OUT, { recursive: true });
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm',
  '.swf': 'application/x-shockwave-flash', '.png': 'image/png',
  '.json': 'application/json', '.css': 'text/css',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const file = path.join(ROOT, decodeURIComponent(url.pathname));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('shot', name);
}

async function click(page, x, y) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(180);
  await page.mouse.click(x, y, { delay: 120 });
  await page.waitForTimeout(800);
}

async function closeInterferingRuffleUi(page) {
  await page.evaluate(() => {
    const sr = document.querySelector('ruffle-player').shadowRoot;
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

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  try {
    await page.goto('http://127.0.0.1:' + port + '/player.html?card=2005-benzin-game', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const gate = page.getByRole('button', { name: /^Start card$/i });
    if (await gate.count()) await gate.first().click();
    await page.waitForTimeout(9000);
    await closeInterferingRuffleUi(page);
    await click(page, 940, 728); // splash JOUER
    await click(page, 256, 531); // menu INSTRUCTIONS
    await click(page, 827, 754); // instructions JOUER
    await page.waitForTimeout(2500);
    await shot(page, '00-baseline');

    // A: real keyboard
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(3000);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(300);
    await shot(page, '01-real-key');

    // B: synthetic at the host (player.js behaviour)
    await page.evaluate(() => {
      const p = document.querySelector('ruffle-player');
      const init = (t) => ({ key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, bubbles: true, cancelable: true });
      p.dispatchEvent(new KeyboardEvent('keydown', init('keydown')));
      window.__synthUp = true;
    });
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      const p = document.querySelector('ruffle-player');
      p.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(300);
    await shot(page, '02-synthetic-host');

    // C: synthetic at shadow #container, composed
    await page.evaluate(() => {
      const sr = document.querySelector('ruffle-player').shadowRoot;
      const c = sr.querySelector('#container') || sr;
      c.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, bubbles: true, cancelable: true, composed: true }));
    });
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      const sr = document.querySelector('ruffle-player').shadowRoot;
      const c = sr.querySelector('#container') || sr;
      c.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, bubbles: true, cancelable: true, composed: true }));
    });
    await page.waitForTimeout(300);
    await shot(page, '03-synthetic-container');

    // D: touch-control button, when present
    const touchToggle = page.getByRole('button', { name: /Touch controls/i });
    if (await touchToggle.count()) {
      const barHidden = await page.locator('#touch-controls').isHidden().catch(() => true);
      if (barHidden) await touchToggle.first().click();
      const accelerate = page.locator('#touch-controls button', { hasText: /Accelerate/i });
      if (await accelerate.count()) {
        const box = await accelerate.first().boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.waitForTimeout(3000);
          await page.mouse.up();
          await page.waitForTimeout(300);
          await shot(page, '04-touch-accelerate');
        }
      } else {
        console.log('accelerate button not found');
      }
    } else {
      console.log('touch toggle not found');
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
