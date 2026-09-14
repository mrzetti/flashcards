/*
 * Focused Benzin input probe.
 *   node benzin-probe.cjs [url]
 * Defaults to the locally served player page (start a server externally) or the
 * live player URL. Closes the Ruffle hardware-acceleration modal through its
 * shadow-DOM close control before interacting.
 */
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const URL_ARG = process.argv[2];
const OUT = path.resolve('/tmp/opencode/benzin-probe');
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

async function closeRuffleModals(page, log) {
  const result = await page.evaluate(() => {
    const sr = document.querySelector('ruffle-player').shadowRoot;
    const out = {};
    for (const id of ['hardware-acceleration-modal', 'unmute-overlay']) {
      const el = sr.querySelector('#' + id);
      out[id] = el ? getComputedStyle(el).display : null;
    }
    const modal = sr.querySelector('#hardware-acceleration-modal');
    if (modal) {
      const close = modal.querySelector('.close-modal');
      if (close) {
        close.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        out.clickedClose = true;
      }
    }
    return out;
  });
  log('modals-before', JSON.stringify(result));
  await page.waitForTimeout(500);
  return result;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('shot', name);
}

async function click(page, x, y, name) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(180);
  await page.mouse.click(x, y, { delay: 120 });
  await page.waitForTimeout(900);
  if (name) await shot(page, name);
}

(async () => {
  let server = null;
  let url = URL_ARG;
  if (!url) {
    server = await startServer();
    url = 'http://127.0.0.1:' + server.address().port + '/player.html?card=2005-benzin-game';
  }
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text().slice(0, 160)); });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const gate = page.getByRole('button', { name: /^Start card$/i });
    if (await gate.count()) await gate.first().click();
    await page.waitForTimeout(9000);
    await shot(page, '00-intro');
    // Close hardware-acceleration modal if open.
    await closeRuffleModals(page, console.log);
    // Also try clicking the close control for real (pointer).
    const close = page.locator('ruffle-player #hardware-acceleration-modal .close-modal');
    if (await close.count()) {
      await close.click({ force: true }).catch(() => {});
      console.log('modal close clicked');
    }
    await page.waitForTimeout(600);
    const overlay = page.locator('ruffle-player #unmute-overlay');
    if (await overlay.count() && await overlay.isVisible().catch(() => false)) {
      await overlay.click({ force: true }).catch(() => {});
      console.log('unmute overlay clicked');
    } else {
      console.log('unmute overlay not visible');
    }
    await page.waitForTimeout(600);
    const check = await page.evaluate(() => {
      const sr = document.querySelector('ruffle-player').shadowRoot;
      const at = sr.elementFromPoint(950, 730);
      const modal = sr.querySelector('#hardware-acceleration-modal');
      const overlay = sr.querySelector('#unmute-overlay');
      return {
        at: at ? '#' + at.id + '.' + at.className : null,
        modalDisplay: modal ? getComputedStyle(modal).display : null,
        overlayDisplay: overlay ? getComputedStyle(overlay).display : null,
      };
    });
    console.log('after close:', JSON.stringify(check));
    // Navigate: splash JOUER -> menu -> INSTRUCTIONS -> JOUER -> game
    await click(page, 940, 728, '01-after-splash-jouer');
    await click(page, 256, 531, '02-after-instructions');
    await click(page, 827, 754, '03-game-start');
    await page.waitForTimeout(2500);
    await shot(page, '04-baseline');
    // Real held keys
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(2500);
    await shot(page, '05-up');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(2000);
    await shot(page, '06-up-left');
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(300);
    await shot(page, '07-released');
    // Synthetic key events at the element (touch-control equivalent)
    const moved = await page.evaluate(() => {
      const p = document.querySelector('ruffle-player');
      const init = (type) => new KeyboardEvent(type, { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, bubbles: true, cancelable: true });
      p.dispatchEvent(init('keydown'));
      setTimeout(() => p.dispatchEvent(init('keyup')), 200);
      return 'sent';
    });
    console.log('synthetic', moved);
    await page.waitForTimeout(2000);
    await shot(page, '08-after-synthetic');
  } finally {
    await browser.close();
    if (server) server.close();
  }
})().catch((error) => { console.error('FAILED', error); process.exit(1); });
