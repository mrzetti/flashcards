/*
 * Verifies the wrapper fix for the Benzin keyboard issue.
 *
 * Root cause (see BENZIN-VERIFICATION.md): player.js calls focusRuffle()
 * synchronously inside the Ruffle `loadedmetadata` event. In Ruffle 0.6 that
 * leaves keyboard input dead (Arrow keys never reach Key.isDown), while mouse
 * clicks and touch-control synthetic keys still work.
 *
 * This script serves the repo with a patched player.js (focus deferred out of
 * the metadata callback) and runs two real-key sessions:
 *   control: unmodified player.js           -> expected: truck does not move
 *   fixed:   setTimeout(focusRuffle, 0)     -> expected: truck drives, score > 0
 *
 *   node benzin-fix-verify.cjs
 */
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = '/tmp/opencode/benzin-fix';
fs.mkdirSync(OUT, { recursive: true });
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm',
  '.swf': 'application/x-shockwave-flash', '.png': 'image/png',
  '.json': 'application/json', '.css': 'text/css',
};

const PATCHED = fs.readFileSync(path.join(ROOT, 'player.js'), 'utf8');
const PATCH_TO = 'window.setTimeout(focusRuffle, 0);';
if (!PATCHED.includes(PATCH_TO)) {
  console.error('player.js no longer contains the deferred metadata focus call; update this script.');
  process.exit(2);
}
// Reintroduce the old bug only in the served control response, never on disk.
const ORIGINAL = PATCHED.replace(PATCH_TO, 'focusRuffle();');

function startServer(usePatch) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/player.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        res.end(usePatch ? PATCHED : ORIGINAL);
        return;
      }
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

async function runSession(browser, port, label) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const click = async (x, y) => { await page.mouse.move(x, y); await page.waitForTimeout(180); await page.mouse.click(x, y, { delay: 120 }); await page.waitForTimeout(800); };
  try {
    await page.goto('http://127.0.0.1:' + port + '/player.html?card=2005-benzin-game', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const gate = page.getByRole('button', { name: /^Start card$/i });
    if (await gate.count()) await gate.first().click();
    await page.waitForTimeout(9000);
    await closeInterferingRuffleUi(page);
    await click(940, 728); // splash JOUER
    await click(256, 531); // menu INSTRUCTIONS
    await click(827, 754); // instructions JOUER
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, label + '-01-baseline.png') });
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, label + '-02-up.png') });
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, label + '-03-up-left.png') });
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, label + '-04-released.png') });
    return errors;
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const controlServer = await startServer(false);
  const fixedServer = await startServer(true);
  try {
    console.log('control session (unmodified player.js)...');
    console.log('control errors:', (await runSession(browser, controlServer.address().port, 'control')).join(' | ') || 'none');
    console.log('fixed session (deferred focus)...');
    console.log('fixed errors:', (await runSession(browser, fixedServer.address().port, 'fixed')).join(' | ') || 'none');
  } finally {
    controlServer.close();
    fixedServer.close();
    await browser.close();
  }
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
