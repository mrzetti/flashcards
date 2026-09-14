#!/usr/bin/env node
/*
 * Runtime interaction verification for the deployed Flashcards site (v2).
 *
 * Per card it:
 *   1. loads player.html?card=<id> and waits for SWF metadata,
 *   2. consumes Ruffle's one-shot CPU-adapter warning modal (headless GPU),
 *   3. detects whether the SWF settles into a static frame,
 *   4. clicks semantic candidate menu points and, if those don't change the
 *      view, sweeps an 8x6 grid to find real clickable regions,
 *   5. samples real Web Audio RMS via qa/audio-probe.js,
 *   6. exercises Mute / volume slider / Restart / Fullscreen,
 *   7. records network requests (incl. external + failed), console logs,
 *      dialogs, popups and Ruffle modals.
 *
 * Usage:
 *   node verify-cards.cjs --only 2005-rosenrot
 *   node verify-cards.cjs --cards 2003-lichtspielhaus,2009-lifad
 *   node verify-cards.cjs --all
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const QA_DIR = path.resolve(__dirname, '..');
const PROBE_JS = fs.readFileSync(path.join(QA_DIR, 'audio-probe.js'), 'utf8');
const OUT_ROOT = path.join(__dirname, 'out');
const BASE = process.env.FLASHCARDS_BASE || 'https://flashcards.rammwiki.mrzetti.com';
const BASE_HOST = new URL(BASE).host;

const ALL_CARDS = [
  '2003-lichtspielhaus',
  '2004-reise-reise',
  '2005-keine-lust',
  '2005-mann-gegen-mann',
  '2005-rosenrot',
  '2006-voelkerball',
  '2009-lifad',
];

/* Candidate click points, fractions of the SWF stage (0,0 = top-left).
 * Points measured from settled-stage screenshots are marked "measured". */
const PLANS = {
  '2003-lichtspielhaus': [
    [0.5, 0.5], [0.5, 0.85], [0.25, 0.85], [0.75, 0.85],
    [0.5, 0.15], [0.15, 0.5], [0.85, 0.5], [0.35, 0.7], [0.65, 0.7],
  ],
  '2004-reise-reise': [
    [0.127, 0.364, 'deutsch'], [0.122, 0.427, 'english'], // measured language gate
    [0.5, 0.5], [0.5, 0.8], [0.2, 0.85], [0.5, 0.85], [0.8, 0.85], [0.5, 0.2],
  ],
  '2005-keine-lust': [
    // measured bottom menu row y=0.816
    [0.211, 0.816, 'INTRO'], [0.258, 0.816, 'INFO'], [0.343, 0.816, 'VIDEO'],
    [0.392, 0.816, 'TOUR'], [0.463, 0.816, 'SCREENSAVER'], [0.542, 0.816, 'BUY'],
    [0.5, 0.5], [0.5, 0.85],
  ],
  '2005-mann-gegen-mann': [
    [0.194, 0.310, 'deutsch'], [0.184, 0.351, 'english'], // measured language gate
    [0.5, 0.5], [0.5, 0.8], [0.2, 0.8], [0.8, 0.8], [0.5, 0.2],
  ],
  '2005-rosenrot': [
    [0.139, 0.605, 'deutsch'], [0.134, 0.659, 'english'], // measured language gate
    [0.5, 0.5], [0.5, 0.8], [0.2, 0.8], [0.8, 0.8], [0.5, 0.2],
  ],
  '2006-voelkerball': [
    [0.5, 0.5], [0.2, 0.85], [0.5, 0.85], [0.8, 0.85],
    [0.35, 0.85], [0.65, 0.85], [0.5, 0.15], [0.2, 0.5], [0.8, 0.5], [0.5, 0.3],
  ],
  '2009-lifad': [
    [0.5, 0.5], [0.5, 0.947, 'ZUR WEBSITE'], // measured link
    [0.5, 0.8], [0.3, 0.8], [0.7, 0.8], [0.5, 0.25], [0.2, 0.5], [0.8, 0.5],
  ],
};

const SETTLE = {
  default: { maxMs: 26000, pollMs: 900 },
  '2004-reise-reise': { maxMs: 40000, pollMs: 1000 },
  '2006-voelkerball': { maxMs: 50000, pollMs: 1000 },
  '2005-keine-lust': { maxMs: 34000, pollMs: 1000 },
};

const CLICK_SETTLE_MS = 900;
const HOVER_SETTLE_MS = 300;
const GRID_COLS = 8;
const GRID_ROWS = 6;
const GRID_MIN_SPACING = 0.09;

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

function parseArgs(argv) {
  const args = { cards: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--only' || arg === '--card') args.cards = [argv[i + 1]];
    else if (arg === '--cards') args.cards = argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--all') args.cards = ALL_CARDS.slice();
  }
  if (!args.cards) args.cards = ALL_CARDS.slice();
  return args;
}

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

async function sampleAudio(page, ms) {
  const started = Date.now();
  const samples = [];
  while (Date.now() - started < ms) {
    try {
      const result = await page.evaluate(() =>
        (typeof window.__audioAudit === 'function' ? window.__audioAudit() : null));
      if (Array.isArray(result)) {
        for (const item of result) samples.push({ state: item.state, time: item.time, peak: item.peak, rms: item.rms });
      }
    } catch (error) {
      samples.push({ error: error.message });
    }
    await page.waitForTimeout(200);
  }
  const rms = samples.filter((s) => typeof s.rms === 'number').map((s) => s.rms);
  const peaks = samples.filter((s) => typeof s.peak === 'number').map((s) => s.peak);
  return {
    sampleCount: samples.length,
    maxRms: rms.length ? Math.max(...rms) : null,
    maxPeak: peaks.length ? Math.max(...peaks) : null,
    states: [...new Set(samples.filter((s) => s.state).map((s) => s.state))],
  };
}

async function getSurface(page) {
  return page.evaluate(() => {
    const player = document.querySelector('ruffle-player');
    if (!player || !player.shadowRoot) return { error: 'no ruffle-player' };
    const canvas = player.shadowRoot.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    const rect = canvas.getBoundingClientRect();
    let meta = null;
    try { meta = player.ruffle().metadata; } catch (e) { return { error: 'ruffle error: ' + e.message }; }
    const scale = Math.min(rect.width / meta.width, rect.height / meta.height);
    const width = meta.width * scale;
    const height = meta.height * scale;
    return {
      stage: { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height },
      canvasRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      meta,
      state: (() => { try { const r = player.ruffle(); return { readyState: r.readyState, isPlaying: r.isPlaying, volume: r.volume, fullscreenEnabled: r.fullscreenEnabled }; } catch (e) { return { error: e.message }; } })(),
    };
  });
}

function ruffleModal(page, id) {
  return page.evaluate((modalId) => {
    const player = document.querySelector('ruffle-player');
    if (!player || !player.shadowRoot) return null;
    const el = player.shadowRoot.getElementById(modalId);
    if (!el) return null;
    return { hidden: el.classList.contains('hidden'), text: (el.textContent || '').trim().slice(0, 160) };
  }, id);
}

async function dismissCpuWarning(page, ctx) {
  const shown = await ruffleModal(page, 'hardware-acceleration-modal');
  if (shown && !shown.hidden) {
    ctx.cpuWarning = shown;
    await page.evaluate(() => {
      const player = document.querySelector('ruffle-player');
      const el = player.shadowRoot.getElementById('hardware-acceleration-modal');
      const close = el && el.querySelector('.close-modal');
      if (close) close.click();
    });
    await page.waitForTimeout(300);
    const after = await ruffleModal(page, 'hardware-acceleration-modal');
    return { shown, dismissed: Boolean(after && after.hidden) };
  }
  return { shown: shown || null, dismissed: false };
}

function playerState(page) {
  return page.evaluate(() => (window.FlashcardsPlayer ? window.FlashcardsPlayer.state : null));
}

function playerPanels(page) {
  return page.evaluate(() => ({
    status: document.getElementById('toolbar-status').textContent,
    loadingHidden: document.getElementById('loading-panel').hidden,
    errorHidden: document.getElementById('error-panel').hidden,
    errorTitle: document.getElementById('error-title').textContent,
    errorMessage: document.getElementById('error-message').textContent,
    unsupportedHidden: document.getElementById('unsupported-panel').hidden,
    muteText: document.getElementById('mute-button').textContent,
    mutePressed: document.getElementById('mute-button').getAttribute('aria-pressed'),
    volumeValue: document.getElementById('volume-value').textContent,
    volumeInput: document.getElementById('volume').value,
    restartDisabled: document.getElementById('restart-button').disabled,
    fullscreenText: document.getElementById('fullscreen-button').textContent,
    fullscreenPressed: document.getElementById('fullscreen-button').getAttribute('aria-pressed'),
    title: document.getElementById('player-title').textContent,
    year: document.getElementById('player-year').textContent,
    fullscreenElement: Boolean(document.fullscreenElement),
  }));
}

async function waitForReady(page, timeout = 120000) {
  try {
    await page.waitForFunction(
      () => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen,
      null,
      { timeout }
    );
    return { ready: true };
  } catch (error) {
    const panels = await playerPanels(page).catch(() => null);
    const state = await playerState(page).catch(() => null);
    return { ready: false, timeout: true, panels, state };
  }
}

async function waitForPlayableError(page, timeout = 30000) {
  try {
    await page.waitForSelector('#error-panel:not([hidden])', { timeout });
    return true;
  } catch (error) { return false; }
}

async function waitForStable(page, clip, options) {
  const opts = options || {};
  const maxMs = opts.maxMs || 9000;
  const pollMs = opts.pollMs || 800;
  const started = Date.now();
  let last = null;
  let lastBuf = null;
  while (Date.now() - started < maxMs) {
    const buf = await page.screenshot({ clip });
    const hash = md5(buf);
    if (last === hash) return { stable: true, elapsedMs: Date.now() - started, hash, buf };
    last = hash;
    lastBuf = buf;
    await page.waitForTimeout(pollMs);
  }
  return { stable: false, elapsedMs: Date.now() - started, hash: last, buf: lastBuf };
}

async function verifyCard(browser, cardId) {
  const outDir = path.join(OUT_ROOT, cardId);
  ensureDir(outDir);
  const ctx = {
    cardId, base: BASE, startedAt: new Date().toISOString(),
    console: [], requests: [], dialogs: [], popups: [], modalSeen: [],
    semanticClicks: [], gridClicks: [], successes: [], issues: [],
    screenshots: [],
  };
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript({ content: PROBE_JS });
  const page = await context.newPage();

  page.on('console', (msg) => {
    ctx.console.push({ type: msg.type(), text: msg.text(), at: new Date().toISOString() });
  });
  page.on('pageerror', (error) => ctx.console.push({ type: 'pageerror', text: error.message, at: new Date().toISOString() }));
  page.on('request', (request) => {
    let external = false;
    try { external = new URL(request.url()).host !== BASE_HOST; } catch (e) { external = true; }
    ctx.requests.push({
      url: request.url(), type: request.resourceType(), method: request.method(),
      external, at: new Date().toISOString(), status: null, failure: null, phase: ctx.phase || 'load',
    });
  });
  page.on('response', (response) => {
    for (let i = ctx.requests.length - 1; i >= 0; i -= 1) {
      const entry = ctx.requests[i];
      if (entry.url === response.url() && entry.status == null && !entry.failure) {
        entry.status = response.status();
        try {
          const headers = response.headers();
          entry.contentLength = headers['content-length'] ? Number(headers['content-length']) : null;
          entry.contentType = headers['content-type'] || null;
        } catch (e) { /* ignore */ }
        break;
      }
    }
  });
  page.on('requestfailed', (request) => {
    for (let i = ctx.requests.length - 1; i >= 0; i -= 1) {
      const entry = ctx.requests[i];
      if (entry.url === request.url() && entry.status == null && !entry.failure) {
        entry.failure = (request.failure() && request.failure().errorText) || 'failed';
        break;
      }
    }
  });
  page.on('dialog', async (dialog) => {
    ctx.dialogs.push({ type: dialog.type(), message: dialog.message(), at: new Date().toISOString() });
    try { await dialog.dismiss(); } catch (e) { /* ignore */ }
  });
  context.on('page', async (popup) => {
    ctx.popups.push(popup.url());
    try { await popup.close(); } catch (e) { /* ignore */ }
  });

  const playerUrl = `${BASE}/player.html?card=${encodeURIComponent(cardId)}`;
  ctx.playerUrl = playerUrl;
  await page.goto(playerUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const ready = await waitForReady(page, 120000);
  ctx.ready = ready;
  if (!ready.ready) {
    ctx.issues.push({ severity: 'blocker', kind: 'metadata-timeout', detail: JSON.stringify(ready) });
    await page.screenshot({ path: path.join(outDir, '00-timeout.png') });
    ctx.panelsAfterLoad = await playerPanels(page).catch(() => null);
    await context.close();
    return ctx;
  }

  ctx.phase = 'initial';
  ctx.stateInitial = await playerState(page);
  ctx.panelsInitial = await playerPanels(page);
  await page.waitForTimeout(1800);
  const surface0 = await getSurface(page);
  ctx.surface = surface0;
  ctx.metadata = surface0.meta;
  if (ctx.metadata) {
    ctx.successes.push(`SWF metadata reported: ${ctx.metadata.width}x${ctx.metadata.height}, ${ctx.metadata.numFrames} frames @ ${ctx.metadata.frameRate} fps, SWF version ${ctx.metadata.swfVersion}, isActionScript3=${ctx.metadata.isActionScript3}`);
    if (ctx.metadata.isActionScript3) ctx.issues.push({ severity: 'note', kind: 'actionscript3' });
  }
  const stage = surface0.stage;
  const clip = {
    x: Math.max(0, Math.floor(stage.x)), y: Math.max(0, Math.floor(stage.y)),
    width: Math.min(1280 - Math.max(0, Math.floor(stage.x)), Math.ceil(stage.width)),
    height: Math.min(900 - Math.max(0, Math.floor(stage.y)), Math.ceil(stage.height)),
  };
  ctx.clip = clip;
  const pt = (fx, fy) => ({
    x: Math.round(stage.x + fx * stage.width),
    y: Math.round(stage.y + fy * stage.height),
  });
  const shotStage = async (name) => {
    const buf = await page.screenshot({ clip });
    fs.writeFileSync(path.join(outDir, name), buf);
    ctx.screenshots.push(name);
    return md5(buf);
  };
  const screenshotCount = () => { let n = 0; try { n = fs.readdirSync(outDir).length; } catch (e) { n = 0; } return n; };
  ctx.initialFullShot = '00-loaded.png';
  await page.screenshot({ path: path.join(outDir, '00-loaded.png') });
  const baselineHash = await shotStage('00-loaded-stage.png');

  // ---- warm-up: consume Ruffle CPU warning modal ----
  const center = pt(0.5, 0.5);
  await page.mouse.move(center.x, center.y);
  await page.waitForTimeout(800);
  ctx.cpuWarningHandling = await dismissCpuWarning(page, ctx);
  if (ctx.cpuWarningHandling.shown) {
    ctx.issues.push({ severity: 'note', kind: 'ruffle-cpu-warning', detail: 'Ruffle showed hardware-acceleration warning (renderer adapter reports CPU, expected in headless SwiftShader): ' + ctx.cpuWarningHandling.shown.text });
    await shotStage('01-cpu-warning.png');
  }
  // move pointer off the stage to reset rollover
  await page.mouse.move(4, 870);
  await page.waitForTimeout(500);

  // ---- settle detection ----
  const settleCfg = SETTLE[cardId] || SETTLE.default;
  const settleStarted = Date.now();
  const hashes = [];
  let stable = false;
  while (Date.now() - settleStarted < settleCfg.maxMs) {
    const h = await page.screenshot({ clip }).then((buf) => md5(buf));
    hashes.push(h);
    if (hashes.length >= 3 && hashes[hashes.length - 1] === hashes[hashes.length - 2] && hashes[hashes.length - 2] === hashes[hashes.length - 3]) {
      stable = true;
      break;
    }
    await page.waitForTimeout(settleCfg.pollMs);
  }
  ctx.settle = { stable, elapsedMs: Date.now() - settleStarted, frames: hashes.length, uniqueFrames: new Set(hashes).size };
  await page.screenshot({ path: path.join(outDir, '05-settled.png') });
  const settledHash = await shotStage('05-settled-stage.png');
  ctx.baselineHash = baselineHash;
  ctx.settledHash = settledHash;
  ctx.successes.push(stable
    ? `SWF settled into a static frame after ${ctx.settle.elapsedMs}ms (${new Set(hashes).size} unique frames)`
    : `SWF was still animating after ${ctx.settle.elapsedMs}ms (${new Set(hashes).size} unique frames)`);

  // ---- semantic click candidates ----
  ctx.phase = 'semantic';
  const points = PLANS[cardId] || PLANS['2003-lichtspielhaus'];
  let previousConsole = ctx.console.length;
  let previousRequests = ctx.requests.length;
  let changes = 0;
  const maxChanges = cardId === '2005-keine-lust' ? 7 : 5;
  for (let i = 0; i < points.length; i += 1) {
    const [fx, fy] = points[i];
    const label = String(i + 1).padStart(2, '0');
    const beforeHoverShot = await page.screenshot({ clip }).then((buf) => md5(buf));
    const p = pt(fx, fy);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(HOVER_SETTLE_MS);
    const hoverShot = await page.screenshot({ clip }).then((buf) => md5(buf));
    await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
    await page.waitForTimeout(CLICK_SETTLE_MS);
    const afterShot = await page.screenshot({ clip });
    const afterHash = md5(afterShot);
    const changed = afterHash !== beforeHoverShot;
    const step = {
      step: label, fx, fy, x: p.x, y: p.y,
      hoverChanged: hoverShot !== beforeHoverShot,
      clickChanged: changed,
      audio: await sampleAudio(page, 800),
      state: await playerState(page),
      newRequests: ctx.requests.slice(previousRequests).map((r) => ({ url: r.url, status: r.status, failure: r.failure, type: r.type, external: r.external })),
      newConsole: ctx.console.slice(previousConsole).map((c) => ({ type: c.type, text: c.text })),
      dialogs: ctx.dialogs.slice(),
      popups: ctx.popups.slice(),
    };
    if (changed) {
      changes += 1;
      fs.writeFileSync(path.join(outDir, `20-sem-${label}-changed.png`), afterShot);
      ctx.screenshots.push(`20-sem-${label}-changed.png`);
      if (step.hoverChanged) await shotStage(`19-sem-${label}-hover.png`);
      step.audio = await sampleAudio(page, 1200);
      step.stabilized = await waitForStable(page, clip, { maxMs: 9000, pollMs: 800 });
      step.settledState = await playerState(page);
      await shotStage(`21-sem-${label}-settled.png`);
      step.modals = await (async () => {
        const modals = await page.evaluate(() => {
          const player = document.querySelector('ruffle-player');
          return player && player.shadowRoot
            ? Array.from(player.shadowRoot.querySelectorAll('.modal')).filter((m) => !m.classList.contains('hidden')).map((m) => m.id || '(no id)')
            : [];
        });
        return modals;
      })();
      ctx.successes.push(`menu click #${label} at (fx=${fx}, fy=${fy}) changed the card view`);
    }
    previousConsole = ctx.console.length;
    previousRequests = ctx.requests.length;
    ctx.semanticClicks.push(step);
    await page.mouse.move(4, 870);
    await page.waitForTimeout(200);
    if (changes >= maxChanges) break;
  }
  ctx.semanticChanges = changes;
  ctx.baselineAfterSemantic = await page.screenshot({ clip }).then((buf) => md5(buf));

  // ---- grid sweep when semantic guesses did not find menus ----
  ctx.phase = 'grid';
  if (changes < 2 && stable) {
    const beforeGridHash = ctx.baselineAfterSemantic;
    let prevHash = beforeGridHash;
    const changedCells = [];
    for (let gy = 0; gy < GRID_ROWS; gy += 1) {
      for (let gx = 0; gx < GRID_COLS; gx += 1) {
        const fx = 0.07 + gx * ((0.86 - 0.07) / (GRID_COLS - 1));
        const fy = 0.09 + gy * ((0.9 - 0.09) / (GRID_ROWS - 1));
        const p = pt(fx, fy);
        const beforeHash = prevHash;
        await page.mouse.move(p.x, p.y);
        await page.waitForTimeout(110);
        await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up();
        await page.waitForTimeout(300);
        const shotBuf = await page.screenshot({ clip });
        const hash = md5(shotBuf);
        const changed = hash !== beforeHash;
        const cell = { gx, gy, fx: Number(fx.toFixed(3)), fy: Number(fy.toFixed(3)), changed };
        if (changed) {
          changedCells.push(cell);
          fs.writeFileSync(path.join(outDir, `30-grid-${gx}-${gy}.png`), shotBuf);
          ctx.screenshots.push(`30-grid-${gx}-${gy}.png`);
          cell.audio = await sampleAudio(page, 900);
          await page.waitForTimeout(900);
          const settled = await page.screenshot({ clip });
          prevHash = md5(settled);
          fs.writeFileSync(path.join(outDir, `31-grid-${gx}-${gy}-settled.png`), settled);
          ctx.screenshots.push(`31-grid-${gx}-${gy}-settled.png`);
        } else {
          prevHash = hash;
        }
        ctx.gridClicks.push(cell);
      }
    }
    ctx.gridChangedCells = changedCells;
    if (changedCells.length) {
      ctx.successes.push(`grid sweep found ${changedCells.length} clickable hotspot(s): ` + changedCells.slice(0, 12).map((c) => `(${c.fx},${c.fy})`).join(' '));
    } else {
      ctx.issues.push({ severity: 'warning', kind: 'no-clickable-hotspots', detail: `Neither semantic candidates nor a ${GRID_COLS}x${GRID_ROWS} grid sweep changed the card view; card appears non-interactive at runtime.` });
    }
  } else if (changes >= 2) {
    ctx.issues.push({ severity: 'note', kind: 'grid-skipped', detail: 'semantic candidates already changed the view; grid sweep skipped' });
  }
  await page.screenshot({ path: path.join(outDir, '39-after-interactions.png') });

  // ---- controls ----
  ctx.phase = 'controls';
  const controls = {};
  controls.before = await playerPanels(page);
  controls.audioBefore = await sampleAudio(page, 1500);
  await page.click('#mute-button');
  await page.waitForTimeout(400);
  controls.afterMutePanels = await playerPanels(page);
  controls.afterMuteState = await playerState(page);
  controls.afterMuteAudio = await sampleAudio(page, 1600);
  await page.screenshot({ path: path.join(outDir, '40-muted.png') });
  await page.click('#mute-button');
  await page.waitForTimeout(400);
  controls.afterUnmutePanels = await playerPanels(page);
  controls.afterUnmuteState = await playerState(page);
  controls.afterUnmuteAudio = await sampleAudio(page, 1200);
  await page.screenshot({ path: path.join(outDir, '41-unmuted.png') });

  if (controls.afterMuteState && controls.afterMuteState.muted === true &&
      controls.afterUnmuteState && controls.afterUnmuteState.muted === false &&
      controls.afterMutePanels.mutePressed === 'true' && controls.afterUnmutePanels.mutePressed === 'false') {
    ctx.successes.push('Mute toggle switched state muted=true -> false and aria-pressed/label followed');
  } else {
    ctx.issues.push({ severity: 'error', kind: 'mute-toggle', detail: JSON.stringify({ mute: controls.afterMuteState, unmute: controls.afterUnmuteState }) });
  }
  const beforeMuteRms = controls.audioBefore.maxRms || 0;
  const mutedRms = controls.afterMuteAudio.maxRms;
  if (beforeMuteRms > 0.0005 && mutedRms != null) {
    if (mutedRms <= beforeMuteRms * 0.35) {
      ctx.successes.push(`Mute dropped measured Web Audio RMS from ${beforeMuteRms.toFixed(4)} to ${mutedRms.toFixed(4)}`);
    } else {
      ctx.issues.push({ severity: 'warning', kind: 'mute-rms', detail: `RMS before=${beforeMuteRms} afterMute=${mutedRms}` });
    }
  }
  ctx.audioEvidence = {
    beforeMuteMaxRms: controls.audioBefore.maxRms,
    afterMuteMaxRms: controls.afterMuteAudio.maxRms,
    afterUnmuteMaxRms: controls.afterUnmuteAudio.maxRms,
    sessionHadSound: beforeMuteRms > 0.0005 || ctx.semanticClicks.some((s) => s.audio && s.audio.maxRms > 0.0005) ||
      (ctx.gridClicks || []).some((c) => c.audio && c.audio.maxRms > 0.0005),
  };

  await page.evaluate(() => {
    const el = document.getElementById('volume');
    el.value = '30';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  controls.volume30Panels = await playerPanels(page);
  controls.volume30State = await playerState(page);
  await page.screenshot({ path: path.join(outDir, '42-volume30.png') });
  await page.evaluate(() => {
    const el = document.getElementById('volume');
    el.value = '80';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  controls.volume80Panels = await playerPanels(page);
  controls.volume80State = await playerState(page);
  if (controls.volume30State && Math.abs(controls.volume30State.volume - 0.3) < 0.001 &&
      controls.volume30Panels.volumeValue === '30%') {
    ctx.successes.push('Volume slider set to 30% updated state.volume=0.3 and the output label');
  } else {
    ctx.issues.push({ severity: 'warning', kind: 'volume-slider', detail: JSON.stringify({ state: controls.volume30State, panels: controls.volume30Panels }) });
  }
  if (controls.volume80State && Math.abs(controls.volume80State.volume - 0.8) < 0.001) {
    ctx.successes.push('Volume slider restored to 80%');
  }

  // ---- restart ----
  const restart = {
    beforeConsole: ctx.console.length, beforeRequests: ctx.requests.length,
  };
  await page.click('#restart-button');
  await page.waitForTimeout(300);
  restart.statusAfterClick = (await playerPanels(page)).status;
  const restartReady = await waitForReady(page, 90000);
  restart.ready = restartReady;
  await page.waitForTimeout(1200);
  restart.panels = await playerPanels(page);
  restart.state = await playerState(page);
  restart.audio = await sampleAudio(page, 1200);
  restart.newRequests = ctx.requests.slice(restart.beforeRequests).map((r) => ({ url: r.url, status: r.status, failure: r.failure }));
  restart.newConsole = ctx.console.slice(restart.beforeConsole).map((c) => ({ type: c.type, text: c.text }));
  await page.screenshot({ path: path.join(outDir, '44-restarted.png') });
  const restartStageBuf = await page.screenshot({ clip });
  fs.writeFileSync(path.join(outDir, '44-restarted-stage.png'), restartStageBuf);
  restart.stageHash = md5(restartStageBuf);
  restart.returnedToInitialFrame = restart.stageHash === ctx.baselineHash;
  controls.restart = restart;
  if (restart.ready.ready && restart.panels && restart.panels.errorHidden) {
    ctx.successes.push(`Restart completed: status "${restart.statusAfterClick}" -> "${restart.panels.status}", SWF re-requested ${restart.newRequests.filter((r) => /\.swf(\?|$)/.test(r.url)).length}x, initial-frame-match=${restart.returnedToInitialFrame}`);
  } else {
    ctx.issues.push({ severity: 'error', kind: 'restart', detail: JSON.stringify({ statusAfterClick: restart.statusAfterClick, ready: restart.ready.ready, panels: restart.panels }) });
  }

  // ---- fullscreen ----
  ctx.phase = 'fullscreen';
  await page.click('#fullscreen-button');
  await page.waitForTimeout(900);
  controls.fullscreenState = await playerPanels(page);
  await page.screenshot({ path: path.join(outDir, '45-fullscreen.png') });
  if (controls.fullscreenState.fullscreenElement) {
    ctx.successes.push('Fullscreen entered via toolbar button (document.fullscreenElement true)');
  } else {
    ctx.issues.push({ severity: 'note', kind: 'fullscreen', detail: 'Fullscreen did not activate in this headless run; status=' + controls.fullscreenState.status });
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  controls.finalState = await playerState(page);
  controls.finalPanels = await playerPanels(page);
  ctx.controls = controls;

  ctx.externalRequests = ctx.requests.filter((r) => r.external).map((r) => ({ url: r.url, status: r.status, failure: r.failure, type: r.type, phase: r.phase }));
  ctx.failedRequests = ctx.requests.filter((r) => r.failure || (r.status && r.status >= 400)).map((r) => ({ url: r.url, status: r.status, failure: r.failure, type: r.type, phase: r.phase }));
  ctx.consoleErrors = ctx.console.filter((c) => c.type === 'error' || c.type === 'pageerror');
  if (ctx.dialogs.length) ctx.issues.push({ severity: 'note', kind: 'dialogs', detail: JSON.stringify(ctx.dialogs) });
  if (ctx.popups.length) ctx.issues.push({ severity: 'note', kind: 'popups', detail: JSON.stringify(ctx.popups.slice(0, 5)) });
  if (!ctx.audioEvidence.sessionHadSound) {
    ctx.issues.push({ severity: 'note', kind: 'audio-silent', detail: 'No measurable Web Audio RMS during this run (card may be silent at these screens, or headless audio path produced no signal)' });
  }

  fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(ctx, null, 2));
  await context.close();
  return ctx;
}

async function checkErrorCases(browser) {
  const outDir = path.join(OUT_ROOT, '_error-cases');
  ensureDir(outDir);
  const record = { cases: [] };
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleLog = [];
  page.on('console', (msg) => consoleLog.push(msg.type() + ': ' + msg.text()));
  page.on('pageerror', (error) => consoleLog.push('pageerror: ' + error.message));

  await page.goto(`${BASE}/player.html`, { waitUntil: 'domcontentloaded' });
  const noCardShown = await waitForPlayableError(page, 30000);
  const noCard = await playerPanels(page);
  await page.screenshot({ path: path.join(outDir, 'no-card.png') });
  record.cases.push({ case: 'no-card', errorShown: noCardShown, panels: noCard });

  await page.goto(`${BASE}/player.html?card=does-not-exist-123`, { waitUntil: 'domcontentloaded' });
  const unknownShown = await waitForPlayableError(page, 30000);
  const unknown = await playerPanels(page);
  await page.screenshot({ path: path.join(outDir, 'unknown-card.png') });
  await page.click('#retry-button');
  await page.waitForTimeout(1500);
  const afterRetry = await playerPanels(page);
  record.cases.push({ case: 'unknown-card', errorShown: unknownShown, panels: unknown, afterRetry });

  record.directCloseLabel = await page.evaluate(() => document.getElementById('error-close').textContent);
  record.console = consoleLog;
  fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(record, null, 2));
  await context.close();
  return record;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  ensureDir(OUT_ROOT);
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage'],
  });
  const summary = { base: BASE, startedAt: new Date().toISOString(), cards: {} };
  try {
    for (const cardId of args.cards) {
      const cardStart = Date.now();
      process.stdout.write(`\n=== ${cardId} ===\n`);
      let result;
      try {
        result = await verifyCard(browser, cardId);
      } catch (error) {
        result = { cardId, fatal: error.message, stack: error.stack };
        ensureDir(path.join(OUT_ROOT, cardId));
        fs.writeFileSync(path.join(OUT_ROOT, cardId, 'run.json'), JSON.stringify(result, null, 2));
      }
      summary.cards[cardId] = {
        ready: result.ready ? result.ready.ready : false,
        metadata: result.metadata || null,
        settle: result.settle || null,
        semanticChanges: result.semanticChanges,
        gridChanged: (result.gridChangedCells || []).length,
        successes: result.successes || [],
        issues: result.issues || [],
        audioEvidence: result.audioEvidence || null,
        externalRequests: result.externalRequests || [],
        failedRequests: result.failedRequests || [],
        dialogs: result.dialogs || [],
        popups: result.popups || [],
        consoleErrorCount: (result.consoleErrors || []).length,
        durationMs: Date.now() - cardStart,
        fatal: result.fatal || null,
      };
      const card = summary.cards[cardId];
      console.log(`ready=${card.ready} settle=${card.settle ? card.settle.stable : '?'} semanticChanged=${card.semanticChanges} gridChanged=${card.gridChanged} issues=${card.issues.length} external=${card.externalRequests.length} failed=${card.failedRequests.length} audio=${JSON.stringify(card.audioEvidence)} ${Math.round(card.durationMs / 1000)}s`);
      card.successes.forEach((s) => console.log('  + ' + s));
      card.issues.forEach((i) => console.log('  ! ' + i.severity + ' ' + i.kind + (i.step ? ' step ' + i.step : '') + ': ' + (i.detail || '').slice(0, 240)));
      if (card.externalRequests.length) console.log('  external: ' + JSON.stringify(card.externalRequests.slice(0, 8)));
      if (card.failedRequests.length) console.log('  failed: ' + JSON.stringify(card.failedRequests.slice(0, 8)));
      fs.writeFileSync(path.join(OUT_ROOT, 'summary.json'), JSON.stringify(summary, null, 2));
    }
    summary.errorCases = await checkErrorCases(browser);
    fs.writeFileSync(path.join(OUT_ROOT, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log('\n=== error cases ===');
    console.log(JSON.stringify(summary.errorCases.cases.map((c) => ({ case: c.case, errorShown: c.errorShown, title: c.panels.errorTitle })), null, 2));
  } finally {
    await browser.close();
  }
  summary.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_ROOT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('\nDone. summary:', path.join(OUT_ROOT, 'summary.json'));
}

main().catch((error) => { console.error('FATAL', error); process.exit(1); });
