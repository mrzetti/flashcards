/*
 * Benzin runtime diagnostics / verification harness.
 *
 * Modes:
 *   node benzin-runtime.cjs local  [outdir]  -> top-level Ruffle + original SWF (control)
 *   node benzin-runtime.cjs live   [outdir]  -> https://flashcards.rammwiki.mrzetti.com/player.html?card=2005-benzin-game
 *   node benzin-runtime.cjs benzin [outdir]  -> https://benzin.rammwiki.mrzetti.com (working project control)
 *
 * Keeps its own browser profile; does not attach to any existing CDP session.
 */
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MODE = process.argv[2] || 'local';
const OUT = path.resolve(process.argv[3] || '/tmp/opencode/benzin-runtime');
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.swf': 'application/x-shockwave-flash',
  '.png': 'image/png',
  '.json': 'application/json',
  '.css': 'text/css',
};

const HARNESS = `<!doctype html>
<html><head><meta charset="utf-8"><title>Benzin local harness</title>
<style>html,body{margin:0;background:#000;overflow:hidden}
#stage{position:absolute;left:30px;top:30px;width:1040px;height:745px;background:#000}
ruffle-player{width:100%;height:100%}</style>
<script src="/assets/ruffle/ruffle.js"></script></head>
<body><div id="stage"></div>
<script>
window.__ready = false;
window.addEventListener('load', function () {
  var p = window.RufflePlayer.newest().createPlayer();
  p.id = 'local-ruffle';
  document.getElementById('stage').appendChild(p);
  p.ruffle().load({
    url: '/originals/2005-benzin-game.swf',
    autoplay: 'on',
    unmuteOverlay: 'hidden',
    backgroundColor: '#000000',
    letterbox: 'on',
    allowScriptAccess: false,
    openUrlMode: 'allow',
    upgradeToHttps: false,
    warnOnUnsupportedContent: true
  }).then(function () { window.__ready = true; });
});
</script></body></html>`;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/harness.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(HARNESS);
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

function installHandlers(page, log) {
  page.on('console', (msg) => log('console:' + msg.type(), msg.text()));
  page.on('pageerror', (err) => log('pageerror', err.message));
  page.on('requestfailed', (req) => log('requestfailed', req.url() + ' ' + (req.failure() ? req.failure().errorText : '')));
  // Close Ruffle hardware-acceleration / renderer modal if it appears.
  for (const name of [/^OK$/i, /^Continue$/i, /^Close$/i, /^Dismiss$/i]) {
    page.addLocatorHandler(page.getByRole('button', { name }), async () => {
      log('modal', 'closing dialog button ' + name);
      await page.getByRole('button', { name }).first().click({ timeout: 2000 }).catch(() => {});
    });
  }
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('shot', name);
}

async function clickAt(page, x, y, name) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(200);
  await page.mouse.click(x, y, { delay: 120 });
  if (name) await screenshot(page, name);
  await page.waitForTimeout(400);
}

async function keyboardDiagnostics(page, log) {
  const frames = page.frames();
  for (const frame of frames) {
    await frame.evaluate(() => {
      window.__keys = [];
      const record = (e) => window.__keys.push({ type: e.type, key: e.key, code: e.code, keyCode: e.keyCode, trusted: e.isTrusted, target: (e.target && e.target.tagName) || '' });
      window.addEventListener('keydown', record, true);
      window.addEventListener('keyup', record, true);
    }).catch(() => {});
  }
  const active = await Promise.all(frames.map((f) => f.evaluate(() => ({
    url: location.href.slice(-60),
    active: document.activeElement ? document.activeElement.tagName : null,
    shadow: (() => { try { const s = document.activeElement && document.activeElement.shadowRoot; return s && s.activeElement ? s.activeElement.id || s.activeElement.tagName : null; } catch (e) { return null; } })(),
  })).catch(() => null)));
  log('focus', JSON.stringify(active));
}

async function readKeys(page, log) {
  for (const frame of page.frames()) {
    const keys = await frame.evaluate(() => window.__keys || []).catch(() => []);
    if (keys.length) log('keys', frame.url().slice(-60) + ' ' + JSON.stringify(keys));
  }
}

async function runLocal(browser, log) {
  const server = await startServer();
  const port = server.address().port;
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  installHandlers(page, log);
  await page.goto(`http://127.0.0.1:${port}/harness.html`);
  await page.waitForTimeout(9000);
  await screenshot(page, '00-intro');
  await keyboardDiagnostics(page, log);
  log('geometry', JSON.stringify(await page.evaluate(() => {
    const p = document.querySelector('ruffle-player');
    const canvas = p && p.shadowRoot ? p.shadowRoot.querySelector('canvas') : null;
    return {
      player: p ? p.getBoundingClientRect().toJSON() : null,
      canvas: canvas ? canvas.getBoundingClientRect().toJSON() : null,
    };
  })));
  // Unmute overlay may still be in the shadow DOM; a stage click dismisses it.
  await clickAt(page, 550, 400, null);
  // Local menu layout: JOUER at left, INSTRUCTIONS below it.
  await clickAt(page, 940, 727, '01-local-jouer');
  await page.waitForTimeout(1200);
  await screenshot(page, '01b-local-after-jouer');
  // Main menu: INSTRUCTIONS; instructions screen: MENU left, JOUER right.
  // unchanged
  await clickAt(page, 215, 550, '01c-local-instructions');
  await page.waitForTimeout(900);
  await screenshot(page, '01d-local-instructions-shown');
  await clickAt(page, 828, 757, '02-local-instructions-jouer');
  await page.waitForTimeout(3000);
  await screenshot(page, '03-baseline');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await screenshot(page, '03b-after-quick-up');

  // Synthetic event test: dispatch directly at the ruffle-player element.
  await page.evaluate(() => {
    const p = document.querySelector('ruffle-player');
    for (const type of ['keydown', 'keyup']) {
      p.dispatchEvent(new KeyboardEvent(type, { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, bubbles: true, cancelable: true }));
    }
  });
  await page.waitForTimeout(1200);
  await screenshot(page, '03c-after-synthetic');

  // Real held keys.
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2500);
  await screenshot(page, '04-up');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(2500);
  await screenshot(page, '05-up-left');
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(100);
  await page.keyboard.up('ArrowUp');
  await readKeys(page, log);
  await screenshot(page, '06-released');

  await server.close();
}

async function runLive(browser, log, targetUrl) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  installHandlers(page, log);
  await page.goto(targetUrl || process.env.PLAYER_URL || 'https://flashcards.rammwiki.mrzetti.com/player.html?card=2005-benzin-game', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const startCard = page.getByRole('button', { name: /^Start card$/i });
  if (await startCard.count()) {
    await startCard.first().click().catch(() => {});
    log('gate', 'clicked Start card');
  }
  await page.waitForTimeout(9000);
  await screenshot(page, '00-intro');
  // Close the Ruffle unmute overlay through its shadow-DOM element.
  const overlay = page.locator('ruffle-player #unmute-overlay');
  if (await overlay.count()) {
    await overlay.click({ force: true }).catch((e) => log('overlay', 'click failed ' + e.message));
    log('overlay', 'clicked');
  } else {
    log('overlay', 'not present');
  }
  await page.waitForTimeout(1200);
  await screenshot(page, '00b-unmuted');
  log('geometry', JSON.stringify(await page.evaluate(() => {
    const p = document.querySelector('ruffle-player');
    const canvas = p && p.shadowRoot ? p.shadowRoot.querySelector('canvas') : null;
    return {
      player: p ? p.getBoundingClientRect().toJSON() : null,
      canvas: canvas ? canvas.getBoundingClientRect().toJSON() : null,
    };
  })));
  await keyboardDiagnostics(page, log);
  // Splash JOUER -> main menu.
  await clickAt(page, 961, 755, '01-main-menu');
  await page.waitForTimeout(900);
  // Main menu INSTRUCTIONS -> instructions screen.
  // unchanged
  await clickAt(page, 215, 550, '02-instructions');
  await page.waitForTimeout(900);
  // Instructions JOUER -> game.
  await clickAt(page, 850, 755, '03-game-baseline-pre');
  await page.waitForTimeout(3000);
  await screenshot(page, '03b-game-baseline');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(4000);
  await screenshot(page, '04-up');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(3000);
  await screenshot(page, '05-up-left');
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowUp');
  await readKeys(page, log);
  await screenshot(page, '06-released');
  // Synthetic fallback: dispatch directly at the player element inside the iframe.
  const moved = await page.evaluate(() => {
    const frame = document.querySelector('iframe');
    const doc = frame && frame.contentDocument;
    const p = doc && doc.querySelector('ruffle-player');
    if (!p) return 'no player';
    p.focus();
    for (const type of ['keydown', 'keyup']) {
      p.dispatchEvent(new KeyboardEvent(type, { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, bubbles: true, cancelable: true }));
    }
    return 'dispatched';
  });
  log('synthetic', moved);
  await page.waitForTimeout(1500);
  await screenshot(page, '07-after-synthetic');
  await readKeys(page, log);
}

async function runBenzin(browser, log) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  installHandlers(page, log);
  await page.goto(process.env.BENZIN_URL || 'https://benzin.rammwiki.mrzetti.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await clickAt(page, 550, 420, null);
  await page.waitForTimeout(1500);
  await clickAt(page, 875, 688, null);
  await clickAt(page, 875, 688, null);
  await page.waitForTimeout(2000);
  await clickAt(page, 310, 525, '01-instructions');
  await page.waitForTimeout(1200);
  await clickAt(page, 790, 687, '02-game-start');
  await page.waitForTimeout(2500);
  await screenshot(page, '03-baseline');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(3000);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowUp');
  await screenshot(page, '04-driven');
  await readKeys(page, log);
}

(async () => {
  const lines = [];
  const log = (tag, msg) => { const line = '[' + tag + '] ' + msg; lines.push(line); console.log(line); };
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    if (MODE === 'local') await runLocal(browser, log);
    else if (MODE === 'live') await runLive(browser, log);
    else if (MODE === 'localpage') { const server = await startServer(); const port = server.address().port; await runLive(browser, log, 'http://127.0.0.1:' + port + '/player.html?card=2005-benzin-game'); await server.close(); }
    else if (MODE === 'benzin') await runBenzin(browser, log);
    else throw new Error('unknown mode ' + MODE);
  } finally {
    fs.writeFileSync(path.join(OUT, 'diagnostics.log'), lines.join('\n') + '\n');
    await browser.close();
  }
})().catch((error) => { console.error('FAILED', error); process.exit(1); });
