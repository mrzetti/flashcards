/*
 * Benzin live verification (keyboard + touch) for the deployed or local wrapper.
 *
 *   # default: public deployment
 *   node qa/benzin-live-verify.cjs
 *
 *   # local final wrapper
 *   FLASHCARDS_URL=http://127.0.0.1:19325/ node qa/benzin-live-verify.cjs
 *
 * Keyboard: focuses the player, holds ArrowUp/ArrowLeft, screenshots the round
 * and checks that the score appears.
 * Touch: delegates to qa/benzin-touch-verify.cjs, which runs real mouse-held
 * buttons and emulated two-finger touch (Accelerate + Turn) with in-browser
 * score/movement assertions.
 */
const { chromium } = require('playwright');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = '/tmp/opencode/benzin-live-verify';
fs.mkdirSync(OUT, { recursive: true });
const TOUCH_SCRIPT = path.join(__dirname, 'benzin-touch-verify.cjs');
const LIVE = new URL('player.html?card=2005-benzin-game', process.env.FLASHCARDS_URL || 'https://flashcards.rammwiki.mrzetti.com/').href;

/* ---- minimal PNG reader for real screenshot checks (shared shape with touch verify) ---- */
const zlib = require('node:zlib');
function decodePng(buf) {
  let pos = 8, w = 0, h = 0, colorType = 6, bitDepth = 8, interlace = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) throw new Error('unsupported PNG');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const channels = colorType === 6 ? 4 : 3;
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride); rp += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
      cur[x] = v;
    }
  }
  return { width: w, height: h, channels, data: out };
}
function brightCount(file, x0, y0, x1, y1) {
  const img = decodePng(fs.readFileSync(file));
  let n = 0;
  for (let y = Math.max(0, y0); y < Math.min(img.height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(img.width, x1); x++) {
      const i = (y * img.width + x) * img.channels;
      if ((img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3 > 170) n++;
    }
  }
  return n;
}

function closeInterferingRuffleUi(page) {
  return page.evaluate(() => {
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
}

async function reachGameplay(page) {
  await page.goto(LIVE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const gate = page.getByRole('button', { name: /^Start card$/i });
  if (await gate.count()) await gate.first().click();
  await page.waitForTimeout(9000);
  await closeInterferingRuffleUi(page);
  const rect = await page.evaluate(() => {
    const host = document.querySelector('ruffle-player');
    return host ? host.getBoundingClientRect().toJSON() : null;
  });
  if (!rect) throw new Error('ruffle-player not present');
  const scale = Math.min(rect.width / 600, rect.height / 450);
  const ox = rect.x + (rect.width - 600 * scale) / 2;
  const oy = rect.y + (rect.height - 450 * scale) / 2;
  const click = async (sx, sy) => {
    const x = ox + sx * scale, y = oy + sy * scale;
    await page.mouse.move(x, y);
    await page.waitForTimeout(180);
    await page.mouse.click(x, y, { delay: 120 });
    await page.waitForTimeout(800);
  };
  await click(535.6, 421); // splash JOUER
  await click(122, 303.7); // main menu INSTRUCTIONS
  await click(467.8, 439.1); // instructions JOUER
  await page.waitForTimeout(2500);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const lines = [];
  const log = (m) => { lines.push(m); console.log(m); };
  let keyboardPass = false;
  try {
    /* ---- keyboard ---- */
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    page.on('pageerror', (e) => log('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') log('console-error: ' + m.text().slice(0, 120)); });
    try {
      await reachGameplay(page);
      await page.evaluate(() => document.querySelector('ruffle-player').focus({ preventScroll: true }));
      const baseline = path.join(OUT, 'keyboard-01-baseline.png');
      const driven = path.join(OUT, 'keyboard-02-after-arrows.png');
      await page.screenshot({ path: baseline });
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(3500);
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(1800);
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.up('ArrowUp');
      await page.waitForTimeout(400);
      await page.screenshot({ path: driven });
      const before = brightCount(baseline, 660, 660, 780, 730);
      const after = brightCount(driven, 660, 660, 780, 730);
      keyboardPass = (after - before) > 20;
      log('keyboard score-area bright before=' + before + ' after=' + after + ' -> ' + (keyboardPass ? 'PASS' : 'FAIL'));
    } finally {
      await page.close();
    }

    /* ---- touch: delegate to the focused touch test with the same URL ---- */
    log('running qa/benzin-touch-verify.cjs against ' + LIVE);
    const result = spawnSync(process.execPath, [TOUCH_SCRIPT], {
      env: { ...process.env, PLAYER_URL: LIVE, OUTDIR: OUT },
      encoding: 'utf8',
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    const touchPass = result.status === 0 && !/CHECK|FAILED/.test(result.stdout || '');
    log('touch run exit=' + result.status + ' -> ' + (touchPass ? 'PASS' : 'FAIL'));

    fs.writeFileSync(path.join(OUT, 'live-verify.log'), lines.join('\n') + '\n');
    fs.writeFileSync(path.join(OUT, 'live-verify-result.json'), JSON.stringify({ url: LIVE, keyboardPass, touchPass }, null, 1));
    if (!keyboardPass || !touchPass) process.exitCode = 2;
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
