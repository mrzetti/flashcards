/*
 * Keine Lust companion repair test.
 *
 * Builds two local staging trees (served on 127.0.0.1) and runs the original,
 * unmodified SWF with the reconstructed player_txt.txt companion:
 *   variant "root":          SWF at /originals/, companion at site root
 *   variant "isolated-dir":  SWF at /assets/cards/2005-keine-lust/, companion there only
 *
 * Verifies the LoadVars success path (player_txt.txt 200 + audio/track1.mp3
 * request) and clicks the real menu buttons with the corrected noScale
 * stage mapping (1:1, canvas-centred).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const QA_DIR = __dirname;
const REPO = path.resolve(QA_DIR, '..');
const PROBE_JS = fs.readFileSync(path.join(QA_DIR, 'audio-probe.js'), 'utf8');
const OUT = path.join(QA_DIR, 'runtime-worker', 'out', '2005-keine-lust');
const STAGE_ROOT = '/tmp/opencode/kl-stage';
const COMPANION = fs.readFileSync(path.join(REPO, 'patches', 'keine-lust', 'player_txt.txt'));
const SWF = path.join(REPO, 'originals', '2005-keine-lust.swf');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.wasm': 'application/wasm', '.swf': 'application/x-shockwave-flash',
  '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png',
};

// The working tree may carry an in-progress wrapper with a standalone start
// gate; stage with the deployed wrapper instead (cached, downloaded on demand).
const WRAPPER_DIR = '/tmp/opencode/kl-deployed';
async function ensureWrapper() {
  fs.mkdirSync(WRAPPER_DIR, { recursive: true });
  for (const f of ['player.html', 'player.js', 'styles.css']) {
    const target = path.join(WRAPPER_DIR, f);
    if (fs.existsSync(target)) continue;
    const response = await fetch(`https://flashcards.rammwiki.mrzetti.com/${f}`);
    if (!response.ok) throw new Error(`wrapper download failed: ${f} ${response.status}`);
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  }
}

function buildStaging(variant) {
  const dir = path.join(STAGE_ROOT, variant);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // Use the deployed (known-good) wrapper files, not the working tree.
  const wrapper = '/tmp/opencode/kl-deployed';
  for (const f of ['player.html', 'player.js', 'styles.css']) {
    fs.copyFileSync(path.join(wrapper, f), path.join(dir, f));
  }
  fs.mkdirSync(path.join(dir, 'assets', 'ruffle'), { recursive: true });
  for (const f of fs.readdirSync(path.join(REPO, 'assets', 'ruffle'))) {
    fs.copyFileSync(path.join(REPO, 'assets', 'ruffle', f), path.join(dir, 'assets', 'ruffle', f));
  }
  let swfPath;
  if (variant === 'root') {
    fs.mkdirSync(path.join(dir, 'originals'), { recursive: true });
    fs.copyFileSync(SWF, path.join(dir, 'originals', '2005-keine-lust.swf'));
    fs.writeFileSync(path.join(dir, 'player_txt.txt'), COMPANION);
    swfPath = 'originals/2005-keine-lust.swf';
  } else {
    fs.mkdirSync(path.join(dir, 'assets', 'cards', '2005-keine-lust'), { recursive: true });
    fs.copyFileSync(SWF, path.join(dir, 'assets', 'cards', '2005-keine-lust', 'player.swf'));
    fs.writeFileSync(path.join(dir, 'assets', 'cards', '2005-keine-lust', 'player_txt.txt'), COMPANION);
    swfPath = 'assets/cards/2005-keine-lust/player.swf';
  }
  const catalog = {
    cards: [{
      id: '2005-keine-lust', title: 'Keine Lust (2005)', swf: swfPath,
      thumbnail: 'assets/thumbnails/2005-keine-lust.jpg', width: 520, height: 520,
      year: 2005, description: 'local repair staging', instructions: 'Mouse', controls: ['Mouse (click)'], status: 'staging', notes: '',
    }],
  };
  fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2));
  return dir;
}

function serve(dir) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(dir, urlPath === '/' ? 'player.html' : urlPath);
    if (!path.resolve(file).startsWith(path.resolve(dir))) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

async function runVariant(browser, variant, dir, port) {
  const record = { variant, swf: variant === 'root' ? '/originals/2005-keine-lust.swf' : '/assets/cards/2005-keine-lust/player.swf', requests: [], console: [], dialogs: [], steps: [] };
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript({ content: PROBE_JS });
  const page = await context.newPage();
  page.on('console', (m) => record.console.push({ type: m.type(), text: m.text() }));
  page.on('request', (r) => record.requests.push({ url: r.url(), status: null, method: r.method() }));
  page.on('response', (r) => {
    const e = record.requests.findLast((x) => x.url === r.url() && x.status == null);
    if (e) e.status = r.status();
  });
  page.on('requestfailed', (r) => {
    const e = record.requests.findLast((x) => x.url === r.url() && x.status == null);
    if (e) e.status = 'FAIL';
  });
  page.on('dialog', async (d) => { record.dialogs.push(d.message()); await d.dismiss().catch(() => {}); });

  await page.goto(`http://127.0.0.1:${port}/player.html?card=2005-keine-lust`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen, null, { timeout: 120000 });
  } catch (error) {
    fs.writeFileSync(path.join(OUT, `repair-${variant}-timeout.json`), JSON.stringify({ requests: record.requests, console: record.console }, null, 2));
    await page.screenshot({ path: path.join(OUT, `repair-${variant}-timeout.png`) });
    throw error;
  }
  await page.waitForTimeout(6000);
  // CPU-warning modal (first mouseover)
  await page.mouse.move(640, 418); await page.waitForTimeout(700);
  await page.evaluate(() => {
    const m = document.querySelector('ruffle-player').shadowRoot.getElementById('hardware-acceleration-modal');
    if (m && !m.classList.contains('hidden')) m.querySelector('.close-modal').click();
  });
  await page.mouse.move(4, 870); await page.waitForTimeout(1200);

  // noScale + centred mapping: stage is drawn 1:1 in the middle of the canvas.
  const geo = await page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    const canvas = player.shadowRoot.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const meta = player.ruffle().metadata;
    return {
      ox: rect.x + rect.width / 2 - meta.width / 2,
      oy: rect.y + rect.height / 2 - meta.height / 2,
      meta: { w: meta.width, h: meta.height },
    };
  });
  record.geometry = geo;
  await page.screenshot({ path: path.join(OUT, `repair-${variant}-00-loaded.png`) });

  // Menu button centres in SWF coordinates (placement + hit size from SWF XML).
  const menu = [
    ['INTRO', 38.1, 483.5], ['INFO', 80.1, 480.0], ['WIN', 118.1, 483.0],
    ['VIDEO', 158.3, 482.0], ['TOUR', 202.3, 481.5], ['SCREENSAVER', 269.8, 482.6],
    ['BUY', 329.1, 483.5],
  ];
  for (const [name, sx, sy] of menu) {
    const x = Math.round(geo.ox + sx); const y = Math.round(geo.oy + sy);
    const before = await page.screenshot({ path: path.join(OUT, `repair-${variant}-${name}-before.png`) });
    const reqCount = record.requests.length; const dlgCount = record.dialogs.length;
    await page.mouse.move(x, y); await page.waitForTimeout(300);
    await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
    await page.waitForTimeout(2200);
    const after = await page.screenshot({ path: path.join(OUT, `repair-${variant}-${name}-after.png`) });
    record.steps.push({
      name, x, y, changed: Buffer.compare(before, after) !== 0,
      newRequests: record.requests.slice(reqCount), dialogs: record.dialogs.slice(dlgCount),
      audio: await page.evaluate(() => window.__audioAudit()),
    });
    await page.mouse.move(4, 870); await page.waitForTimeout(250);
  }

  record.playerTxt = record.requests.filter((r) => r.url.includes('player_txt'));
  record.trackRequests = record.requests.filter((r) => /audio\/track/i.test(r.url));
  record.failed = record.requests.filter((r) => r.status === 'FAIL');
  fs.writeFileSync(path.join(OUT, `repair-${variant}.json`), JSON.stringify(record, null, 2));
  await context.close();
  return record;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await ensureWrapper();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const results = [];
  for (const variant of ['root', 'isolated-dir']) {
    const dir = buildStaging(variant);
    const { server, port } = await serve(dir);
    try {
      const record = await runVariant(browser, variant, dir, port);
      results.push(record);
      console.log(`== ${variant}`);
      console.log('  swf:', record.swf);
      console.log('  player_txt requests:', JSON.stringify(record.playerTxt));
      console.log('  track requests:', JSON.stringify(record.trackRequests));
      console.log('  console LoadVars:', record.console.filter((c) => /LoadVars|player_txt/i.test(c.text)).map((c) => c.text.slice(0, 160)));
      for (const s of record.steps) {
        console.log(`  ${s.name}: changed=${s.changed} dialogs=${s.dialogs.length} newReq=${s.newRequests.map((r) => r.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, '') + ':' + (r.status === null ? '?' : r.status)).join(',')} rms=${s.audio && s.audio[0] ? s.audio[0].rms : null}`);
      }
    } finally {
      server.close();
    }
  }
  console.log('RESULTS-SAVED', OUT);
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
