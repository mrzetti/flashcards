/*
 * Benzin Ruffle config bisect.
 * Runs the original SWF in top-level harness pages with different Ruffle load
 * options / wrapper behaviours and reports whether Arrow keys move the truck
 * (score appears / world scrolls).
 *
 *   node benzin-config-bisect.cjs
 */
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = '/tmp/opencode/benzin-bisect';
fs.mkdirSync(OUT, { recursive: true });
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm',
  '.swf': 'application/x-shockwave-flash', '.png': 'image/png',
  '.json': 'application/json', '.css': 'text/css',
};

function page(label, options, metadataJs, preloadJs) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>bisect ${label}</title>
<style>html,body{margin:0;background:#000}ruffle-player{position:absolute;left:0;top:29px;width:1100px;height:743px}</style>
<script src="/assets/ruffle/ruffle.js"></script></head><body>
<script>
window.addEventListener('load', function () {
  var p = window.RufflePlayer.newest().createPlayer();
  document.body.appendChild(p);
  ${preloadJs || ''}
  p.addEventListener('loadedmetadata', function () { ${metadataJs || ''} });
  p.ruffle().load(${JSON.stringify(options)});
});
</script></body></html>`;
}

const VARIANTS = {
  'B-harness': {
    options: { url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'hidden', openUrlMode: 'allow', upgradeToHttps: false, letterbox: 'on' },
    metadata: '',
  },
  'A-player-opts': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: '',
  },
  'A-plus-metadata-js': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: 'try { p.ruffle().volume = 0.8; } catch (e) {}\n    try { p.focus({ preventScroll: true }); } catch (e) {}',
  },
  'A-no-warn': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: false,
    },
    metadata: 'try { p.ruffle().volume = 0.8; } catch (e) {}\n    try { p.focus({ preventScroll: true }); } catch (e) {}',
  },
  'A-no-confirm': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'hidden', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'allow', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: 'try { p.ruffle().volume = 0.8; } catch (e) {}\n    try { p.focus({ preventScroll: true }); } catch (e) {}',
  },
  'A-focus-deferred': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: 'setTimeout(function () { try { p.focus({ preventScroll: true }); } catch (e) {} }, 1500);',
  },
  'A-focus-then-blur': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: 'try { p.focus({ preventScroll: true }); } catch (e) {}\n    setTimeout(function () { try { p.blur(); } catch (e) {} }, 1200);',
  },
  'A-focus-on-click': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: 'document.addEventListener("pointerdown", function once() { document.removeEventListener("pointerdown", once); setTimeout(function () { try { p.focus({ preventScroll: true }); } catch (e) {} }, 0); });',
  },
  'A-focus-before-load': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: '',
    preload: 'try { p.focus({ preventScroll: true }); } catch (e) {}',
  },
  'A-focus-deferred-0': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: 'setTimeout(function () { try { p.focus({ preventScroll: true }); } catch (e) {} }, 0);',
  },
  'A-focus-deferred-50': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: 'setTimeout(function () { try { p.focus({ preventScroll: true }); } catch (e) {} }, 50);',
  },
  'A-volume-only': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: 'try { p.ruffle().volume = 0.8; } catch (e) {}',
  },
  'A-focus-only': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: 'try { p.focus({ preventScroll: true }); } catch (e) {}',
  },
  'A-volume-deferred': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: 'setTimeout(function () { try { p.ruffle().volume = 0.8; } catch (e) {} }, 0);',
  },
  'A-container-focus': {
    options: {
      url: '/originals/2005-benzin-game.swf', autoplay: 'on', unmuteOverlay: 'visible', backgroundColor: '#000000',
      letterbox: 'on', allowScriptAccess: false, openUrlMode: 'confirm', upgradeToHttps: true, warnOnUnsupportedContent: true,
    },
    metadata: 'var c = p.shadowRoot && p.shadowRoot.querySelector("#container"); if (c && c.focus) { try { c.focus({ preventScroll: true }); } catch (e) {} }',
  },
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/variant/')) {
        const key = decodeURIComponent(url.pathname.split('/')[2]);
        const variant = VARIANTS[key];
        if (!variant) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page(key, variant.options, variant.metadata, variant.preload));
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

async function closeModalsAndOverlays(page, log) {
  // hardware acceleration modal
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
  log('closed modals/overlays');
}

async function runVariant(browser, port, key, log) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', (e) => log('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') log('console-error: ' + m.text().slice(0, 140)); });
  const sh = async (n) => page.screenshot({ path: path.join(OUT, key + '-' + n + '.png') });
  const click = async (x, y) => { await page.mouse.move(x, y); await page.waitForTimeout(180); await page.mouse.click(x, y, { delay: 120 }); await page.waitForTimeout(800); };
  try {
    await page.goto(`http://127.0.0.1:${port}/variant/${key}`);
    await page.waitForTimeout(9000);
    await sh('00-intro');
    await closeModalsAndOverlays(page, log);
    await click(940, 728); // splash JOUER
    await click(256, 531); // menu INSTRUCTIONS
    await click(827, 754); // instructions JOUER
    await page.waitForTimeout(2500);
    await sh('01-baseline');
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(3500);
    await sh('02-up');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(2000);
    await sh('03-up-left');
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(200);
    await sh('04-released');
    const score = await page.screenshot({ path: path.join(OUT, key + '-final.png') });
    return true;
  } finally {
    await page.close();
  }
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const lines = [];
  const log = (msg) => { lines.push(msg); console.log(msg); };
  try {
    for (const key of Object.keys(VARIANTS)) {
      log('==== variant ' + key);
      await runVariant(browser, port, key, log).catch((e) => log('variant failed ' + e.message));
    }
  } finally {
    fs.writeFileSync(path.join(OUT, 'bisect.log'), lines.join('\n') + '\n');
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
