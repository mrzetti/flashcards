/*
 * Benzin touch / mouse input verification.
 *
 * Exercises the real browser input paths against the player page and asserts
 * actual on-screen results (truck movement and a nonzero score), not just DOM
 * events:
 *
 *   mouse-hold       real mouse holds the on-screen Accelerate button
 *   touch-two-finger emulated touch: finger 1 holds Accelerate, finger 2 adds
 *                    Turn left, then releases
 *   keyboard-button  focus an on-screen button and hold Space
 *
 * Default target is the stable local wrapper; override with PLAYER_URL, e.g.
 *   PLAYER_URL=https://flashcards.rammwiki.mrzetti.com/player.html?card=2005-benzin-game \
 *     node qa/benzin-touch-verify.cjs
 *
 * Screenshots and results.json are written to /tmp/opencode/benzin-touch-verify.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const URL = process.env.PLAYER_URL || 'http://127.0.0.1:19325/player.html?card=2005-benzin-game';
const OUT = process.env.OUTDIR || '/tmp/opencode/benzin-touch-verify';
fs.mkdirSync(OUT, { recursive: true });

/* ---------------- tiny PNG reader (for real screenshot assertions) ---------------- */

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
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) throw new Error('unsupported PNG format');
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

function brightCount(file, x0, y0, x1, y1, threshold) {
  const img = decodePng(fs.readFileSync(file));
  let n = 0;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(img.height, y1); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(img.width, x1); x++) {
      const i = (y * img.width + x) * img.channels;
      const gray = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
      if (gray > (threshold || 170)) n++;
    }
  }
  return n;
}

function changedRatio(fileA, fileB, x0, y0, x1, y1, delta) {
  const a = decodePng(fs.readFileSync(fileA));
  const b = decodePng(fs.readFileSync(fileB));
  const threshold = delta || 40;
  let changed = 0, total = 0;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(a.height, y1); y += 2) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(a.width, x1); x += 2) {
      const ia = (y * a.width + x) * a.channels;
      const ib = (y * b.width + x) * b.channels;
      const da = Math.abs(a.data[ia] - b.data[ib]);
      const db = Math.abs(a.data[ia + 1] - b.data[ib + 1]);
      const dc = Math.abs(a.data[ia + 2] - b.data[ib + 2]);
      total++;
      if (da + db + dc > threshold * 3) changed++;
    }
  }
  return changed / Math.max(1, total);
}

/* ---------------- page helpers ---------------- */

const INIT = () => {
  window.__ptrs = [];
  const rec = (e) => window.__ptrs.push({ type: e.type, pointerId: e.pointerId, pointerType: e.pointerType,
    target: e.target && (e.target.tagName + (e.target.id ? '#' + e.target.id : '') + (e.target.dataset && e.target.dataset.key ? '[' + e.target.dataset.key + ']' : '')) });
  for (const t of ['pointerdown', 'pointerup', 'pointercancel']) {
    window.addEventListener(t, rec, true);
  }
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

async function reachGameplay(page, log) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
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
  const point = (sx, sy) => ({ x: ox + sx * scale, y: oy + sy * scale });
  const click = async (sx, sy) => {
    const p = point(sx, sy);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(180);
    await page.mouse.click(p.x, p.y, { delay: 120 });
    await page.waitForTimeout(800);
  };
  await click(535.6, 421); // splash JOUER
  await click(122, 303.7); // main menu INSTRUCTIONS
  await click(467.8, 439.1); // instructions JOUER
  await page.waitForTimeout(2500);

  const toggle = page.getByRole('button', { name: /Touch controls/i });
  if (await toggle.count() && await page.locator('#touch-controls').isHidden()) {
    await toggle.first().click();
    await page.waitForTimeout(300);
  }
  return { rect, scale, ox, oy, point };
}

async function buttonBox(page, label) {
  const button = page.locator('#touch-controls button', { hasText: new RegExp(label, 'i') });
  if (!(await button.count())) throw new Error('missing touch button ' + label);
  return button.first().boundingBox();
}

/* ---------------- scenarios ---------------- */

async function scenarioMouseHold(browser, log) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await context.addInitScript(INIT);
  const page = await context.newPage();
  const shots = {};
  try {
    await reachGameplay(page, log);
    shots.baseline = path.join(OUT, 'mouse-hold-01-baseline.png');
    await page.screenshot({ path: shots.baseline });
    const box = await buttonBox(page, 'Accelerate');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(120);
    await page.mouse.down();
    await page.waitForTimeout(2000);
    shots.held = path.join(OUT, 'mouse-hold-02-held.png');
    await page.screenshot({ path: shots.held });
    await page.waitForTimeout(2500);
    shots.late = path.join(OUT, 'mouse-hold-03-late.png');
    await page.screenshot({ path: shots.late });
    await page.mouse.up();
    await page.waitForTimeout(600);
    shots.released = path.join(OUT, 'mouse-hold-04-released.png');
    await page.screenshot({ path: shots.released });
    return { id: 'mouse-hold', shots, ptrs: await page.evaluate(() => window.__ptrs) };
  } finally {
    await context.close();
  }
}

async function scenarioTouchTwoFinger(browser, log) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, hasTouch: true });
  await context.addInitScript(INIT);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 8, radiusY: 8, force: 1 })),
  });
  const shots = {};
  try {
    await reachGameplay(page, log);
    shots.baseline = path.join(OUT, 'touch-two-finger-01-baseline.png');
    await page.screenshot({ path: shots.baseline });

    const gas = await buttonBox(page, 'Accelerate');
    const turn = await buttonBox(page, 'Turn left');
    const finger1 = { id: 1, x: gas.x + gas.width / 2, y: gas.y + gas.height / 2 };
    const finger2 = { id: 2, x: turn.x + turn.width / 2, y: turn.y + turn.height / 2 };

    await send('touchStart', [finger1]);
    await page.waitForTimeout(1500);
    shots.gas = path.join(OUT, 'touch-two-finger-02-gas.png');
    await page.screenshot({ path: shots.gas });

    await send('touchStart', [finger1, finger2]);
    await page.waitForTimeout(1200);
    shots.turn = path.join(OUT, 'touch-two-finger-03-gas-turn.png');
    await page.screenshot({ path: shots.turn });
    await page.waitForTimeout(1600);
    shots.turnLate = path.join(OUT, 'touch-two-finger-04-gas-turn-late.png');
    await page.screenshot({ path: shots.turnLate });

    await send('touchEnd', [finger1]); // release steering finger
    await page.waitForTimeout(800);
    shots.steerReleased = path.join(OUT, 'touch-two-finger-05-steer-released.png');
    await page.screenshot({ path: shots.steerReleased });

    await send('touchEnd', []); // release gas
    await page.waitForTimeout(600);
    shots.released = path.join(OUT, 'touch-two-finger-06-released.png');
    await page.screenshot({ path: shots.released });

    return { id: 'touch-two-finger', shots, ptrs: await page.evaluate(() => window.__ptrs) };
  } finally {
    await context.close();
  }
}

async function scenarioKeyboardButton(browser, log) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await context.newPage();
  const shots = {};
  try {
    await reachGameplay(page, log);
    const button = page.locator('#touch-controls button', { hasText: /Accelerate/i }).first();
    await button.focus();
    await page.waitForTimeout(150);
    shots.baseline = path.join(OUT, 'keyboard-button-01-baseline.png');
    await page.screenshot({ path: shots.baseline });
    await page.keyboard.down('Space');
    await page.waitForTimeout(3000);
    shots.held = path.join(OUT, 'keyboard-button-02-held.png');
    await page.screenshot({ path: shots.held });
    await page.keyboard.up('Space');
    await page.waitForTimeout(700);
    shots.released = path.join(OUT, 'keyboard-button-03-released.png');
    await page.screenshot({ path: shots.released });
    const heldAfter = await page.locator('#touch-controls button.held').count();
    return { id: 'keyboard-button', shots, buttonsStillHeld: heldAfter };
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const results = [];
  let allPass = true;
  const errors = [];
  const log = (m) => { errors.push(m); console.log(m); };
  try {
    for (const [name, fn] of [['mouse-hold', scenarioMouseHold], ['touch-two-finger', scenarioTouchTwoFinger], ['keyboard-button', scenarioKeyboardButton]]) {
      process.stdout.write('scenario ' + name + ' ... ');
      const r = await fn(browser, log);
      // Real on-screen assertions using the score area of the canvas.
      const rect = await (async () => null)(); // rect not needed; use fractions of the fixed viewport
      const scoreRegion = [660, 660, 780, 730]; // score digits (not the 'Score :' label), 1100x900 layout
      const keys = Object.keys(r.shots);
      const scores = {};
      for (const k of keys) scores[k] = brightCount(r.shots[k], ...scoreRegion);
      const moved = {};
      const baseline = r.shots.baseline;
      for (const k of keys) {
        if (k === 'baseline') continue;
        moved[k] = +changedRatio(baseline, r.shots[k], 60, 40, 1040, 600).toFixed(4);
      }
      r.scores = scores;
      r.movedFromBaseline = moved;
      const scoreDelta = Math.max(0, ...Object.entries(scores)
        .filter(([k]) => k !== 'baseline')
        .map(([, v]) => v - scores.baseline));
      const movement = Math.max(0, ...Object.values(moved));
      const releasedHeld = r.id === 'keyboard-button' ? r.buttonsStillHeld === 0 : true;
      // Single-finger touch gas must already move the truck before the second
      // finger is added (the original public failure was gas-only).
      const gasPhaseOk = r.id === 'touch-two-finger' ? moved.gas > 0.02 : true;
      r.analysis = { scoreDelta, movement, releasedHeld, gasPhaseOk };
      r.pass = scoreDelta > 20 && movement > 0.02 && releasedHeld && gasPhaseOk;
      results.push(r);
      if (!r.pass) allPass = false;
      console.log(r.pass ? 'PASS' : 'CHECK', JSON.stringify({ scores, moved, analysis: r.analysis }));
    }
  } finally {
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ url: URL, results, errors }, null, 1));
    await browser.close();
    if (!allPass) process.exitCode = 2;
  }
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
