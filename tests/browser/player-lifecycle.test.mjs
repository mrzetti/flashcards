import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  destroyedCount,
  frameFor,
  launchBrowser,
  launchCard,
  newPage,
  openDesktop,
  startTestServer,
  waitForDestroyed,
  waitForFrame,
  waitForPlayerStatus,
} from './helpers.mjs';

let server;
let browser;

before(async () => {
  server = await startTestServer();
  browser = await launchBrowser();
});

after(async () => {
  if (browser) await browser.close();
  if (server) await server.close();
});

function callsOf(frame) {
  return frame.evaluate(() => (window.__ruffleMock ? window.__ruffleMock.calls : []));
}

test('Launch starts exactly one mocked Ruffle player with the card file and focuses it', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
  try {
    await openDesktop(page, server.baseURL);
    assert.equal(await page.locator('iframe').count(), 0);

    await launchCard(page, 'alpha');
    await page.waitForSelector('.player-stage-holder iframe');
    assert.equal(await page.locator('.player-stage-holder iframe').count(), 1);
    const iframeSource = await page.getAttribute('.player-stage-holder iframe', 'src');
    assert.match(iframeSource, /^player\.html\?/);
    const params = new URL(iframeSource, server.baseURL).searchParams;
    assert.equal(params.get('card'), 'alpha');
    assert.equal(params.get('instance'), '1');

    const frame = await waitForFrame(page, 'alpha');
    assert.ok(frame, 'the alpha player frame exists');
    await frame.waitForSelector('.mock-ruffle-player');
    await waitForPlayerStatus(page, 'playing');
    assert.match(await page.locator('#player-window-status').textContent(), /Playing: Alpha Anthem/);

    const calls = await callsOf(frame);
    const load = calls.find((call) => call.method === 'load');
    assert.ok(load, 'ruffle().load was called');
    assert.match(load.options.url, /\/cards\/alpha\.swf$/);
    assert.match(load.options.base, /\/cards\/$/, 'SWF companions stay next to the card file');
    assert.equal(load.options.autoplay, 'on');
    assert.equal(load.options.letterbox, 'on');
    assert.equal(load.options.allowScriptAccess, false);
    assert.equal(load.options.backgroundColor, '#000000');
    assert.ok(calls.some((call) => call.method === 'volume' && call.value === 0.8), 'volume applied');

    // Concise instructions stay visible; forensic detail is collapsible.
    assert.match(await frame.locator('#player-instructions').textContent(), /How to play: Click the stage to begin\./);
    assert.match(await frame.locator('#player-controls-line').textContent(), /Controls: Mouse/);
    assert.equal(await frame.locator('#player-details').count(), 1);
    assert.match(await frame.locator('#player-details-body').textContent(), /Catalog status: Verified playback/);
    assert.match(await frame.locator('#player-details-body').textContent(), /Fixture used by the browser tests/);

    // Focus lands inside Ruffle so keyboard input reaches the card.
    await frame.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('mock-ruffle-player'));

    // English, accessible media controls live in the player.
    assert.equal(await frame.locator('#volume').getAttribute('aria-label'), 'Volume: 80 percent');
    assert.equal(await frame.locator('#mute-button').textContent(), 'Mute');
    assert.equal(await frame.locator('#mute-button').getAttribute('aria-pressed'), 'false');
    assert.equal(await frame.locator('#restart-button').textContent(), 'Restart');
    assert.equal(await frame.locator('#fullscreen-button').textContent(), 'Fullscreen');
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Switching cards closes the old player before opening the next one', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
  try {
    await openDesktop(page, server.baseURL);
    await launchCard(page, 'alpha');
    await waitForPlayerStatus(page, 'playing');
    assert.equal(await destroyedCount(page), 0);

    await launchCard(page, 'beta');
    assert.equal(await page.locator('.player-stage-holder iframe').count(), 1, 'only one iframe at any time');
    const source = await page.getAttribute('.player-stage-holder iframe', 'src');
    assert.equal(new URL(source, server.baseURL).searchParams.get('card'), 'beta');
    assert.equal(new URL(source, server.baseURL).searchParams.get('instance'), '2');

    await waitForDestroyed(page, 1);
    await waitForPlayerStatus(page, 'playing');
    const frames = page.frames().filter((frame) => frame.url().includes('player.html'));
    assert.equal(frames.length, 1, 'the previous player frame is gone');
    assert.equal(new URL(frames[0].url()).searchParams.get('card'), 'beta');

    // Keyboard forwarding after focus: the beta card maps arrow keys.
    const beta = frameFor(page, 'beta');
    await beta.waitForSelector('.mock-ruffle-player');
    await page.keyboard.press('ArrowLeft');
    const calls = await callsOf(beta);
    const keyCalls = calls.filter((call) => call.method === 'key' && call.code === 'ArrowLeft');
    assert.equal(keyCalls.filter((call) => call.type === 'keydown').length, 1);
    assert.equal(keyCalls.filter((call) => call.type === 'keyup').length, 1);
    assert.equal(keyCalls[0].keyCode, 37);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Minimize pauses the player and restore resumes only when it was playing', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
  try {
    await openDesktop(page, server.baseURL);
    await launchCard(page, 'beta');
    await waitForPlayerStatus(page, 'playing');
    const beta = frameFor(page, 'beta');

    await page.click('.window[data-window-id="player"] .window-button.minimize');
    await page.waitForFunction(() => window.FlashcardsDesktop.player.status === 'paused');
    assert.match(await page.locator('#player-window-status').textContent(), /Paused while minimized/);
    await beta.waitForFunction(() => window.__ruffleMock.calls.some((call) => call.method === 'suspend'));
    let calls = await callsOf(beta);
    assert.ok(calls.some((call) => call.method === 'suspend'), 'minimize suspends the player');

    await page.click('.task-button:has-text("Beta Racer")');
    await page.waitForFunction(() => window.FlashcardsDesktop.player.status === 'playing');
    await beta.waitForFunction(() => window.__ruffleMock.calls.some((call) => call.method === 'resume'));
    calls = await callsOf(beta);
    assert.ok(calls.some((call) => call.method === 'resume'), 'restore resumes a card that was playing');

    // A card that is in an error state must not resume when restored.
    await launchCard(page, 'broken');
    await waitForPlayerStatus(page, 'error');
    const broken = frameFor(page, 'broken');
    await page.click('.window[data-window-id="player"] .window-button.minimize');
    await page.waitForFunction(() => window.FlashcardsDesktop.player.status === 'paused');
    await page.click('.task-button:has-text("Broken Demo")');
    await page.waitForFunction(() => window.FlashcardsDesktop.player.status === 'error');
    const brokenCalls = await callsOf(broken);
    assert.equal(brokenCalls.some((call) => call.method === 'resume'), false, 'nothing resumes an errored card');
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Volume, mute, restart and fullscreen controls work and report state', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
  try {
    await openDesktop(page, server.baseURL);
    await launchCard(page, 'alpha');
    await waitForPlayerStatus(page, 'playing');
    const frame = frameFor(page, 'alpha');

    await frame.locator('#volume').fill('40');
    let calls = await callsOf(frame);
    assert.ok(calls.some((call) => call.method === 'volume' && call.value === 0.4), 'volume 40% applied');
    assert.equal(await frame.locator('#volume-value').textContent(), '40%');

    await frame.locator('#mute-button').click();
    calls = await callsOf(frame);
    assert.ok(calls.some((call) => call.method === 'volume' && call.value === 0), 'mute sets volume to 0');
    assert.equal(await frame.locator('#mute-button').textContent(), 'Unmute');
    assert.equal(await frame.locator('#mute-button').getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(() => window.FlashcardsDesktop.player.muted === true);

    await frame.locator('#mute-button').click();
    assert.equal(await frame.locator('#mute-button').textContent(), 'Mute');
    calls = await callsOf(frame);
    assert.ok(calls.some((call) => call.method === 'volume' && call.value === 0.4), 'unmute restores the level');

    await frame.evaluate(() => {
      window.__fullscreenRequested = 0;
      window.__fullscreenActive = false;
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => (window.__fullscreenActive ? document.documentElement : null),
      });
      document.documentElement.requestFullscreen = () => {
        window.__fullscreenRequested += 1;
        window.__fullscreenActive = true;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      };
      document.exitFullscreen = () => {
        window.__fullscreenActive = false;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      };
    });
    await frame.locator('#fullscreen-button').click();
    assert.equal(await frame.evaluate(() => window.__fullscreenRequested), 1);
    assert.equal(await frame.locator('#fullscreen-button').textContent(), 'Exit fullscreen');
    await frame.locator('#fullscreen-button').click();
    assert.equal(await frame.locator('#fullscreen-button').textContent(), 'Fullscreen');

    const reloadsBefore = (await callsOf(frame)).filter((call) => call.method === 'reload').length;
    await frame.locator('#restart-button').click();
    await frame.waitForFunction(
      (count) => window.__ruffleMock.calls.filter((call) => call.method === 'reload').length > count,
      reloadsBefore,
    );
    await frame.waitForFunction(() => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen);
    calls = await callsOf(frame);
    assert.equal(calls.filter((call) => call.method === 'reload').length, reloadsBefore + 1);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Slow cards keep a visible loading state until metadata arrives', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
  try {
    await openDesktop(page, server.baseURL);
    await launchCard(page, 'slow');
    const frame = await waitForFrame(page, 'slow');
    await frame.waitForSelector('#loading-panel:visible');
    assert.match(await page.locator('#player-window-status').textContent(), /loading|waiting|starting/i);
    await waitForPlayerStatus(page, 'playing', 10000);
    assert.equal(await frame.locator('#loading-panel').isVisible(), false);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Broken cards show an error panel and Close player releases the iframe', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
  try {
    await openDesktop(page, server.baseURL);
    await launchCard(page, 'broken');
    await waitForPlayerStatus(page, 'error');
    const frame = frameFor(page, 'broken');
    await frame.waitForSelector('#error-panel:visible');
    assert.match(await frame.locator('#error-message').textContent(), /Mock Ruffle could not decode/);
    assert.match(await page.locator('#player-window-status').textContent(), /Player error/);

    await frame.locator('#error-close').click();
    await page.waitForSelector('.window[data-window-id="player"]', { state: 'detached' });
    assert.equal(await page.locator('iframe').count(), 0);
    await waitForDestroyed(page, 1);
    assert.equal(await page.evaluate(() => window.FlashcardsDesktop.player.cardId), null);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('A missing Ruffle script produces a visible unsupported state', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
  try {
    await page.route('**/assets/ruffle/ruffle.js', (route) => route.fulfill({
      status: 404,
      contentType: 'text/plain',
      body: 'missing ruffle build',
    }));
    await openDesktop(page, server.baseURL);
    await launchCard(page, 'alpha');
    await waitForPlayerStatus(page, 'unsupported');
    const frame = frameFor(page, 'alpha');
    await frame.waitForSelector('#unsupported-panel:visible');
    assert.match(await frame.locator('#unsupported-message').textContent(), /assets\/ruffle\/ruffle\.js/);
    assert.match(await page.locator('#player-window-status').textContent(), /Ruffle is unavailable/);
    // The window stays open so the explanation is readable.
    assert.equal(await page.locator('.window[data-window-id="player"]').count(), 1);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Forged or stale player messages are ignored by the host', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
  try {
    await openDesktop(page, server.baseURL);
    await launchCard(page, 'alpha');
    await waitForPlayerStatus(page, 'playing');
    const frame = frameFor(page, 'alpha');

    // Correct source (the iframe) but wrong shape: no cardId, wrong instance.
    await frame.evaluate(() => {
      parent.postMessage({ channel: 'flashcards-player', type: 'error', message: 'forged' }, '*');
      parent.postMessage({ channel: 'flashcards-player', type: 'status', state: 'error', cardId: 'alpha', instance: 999 }, '*');
      parent.postMessage({ channel: 'flashcards-player', type: 'status', state: 'error', instance: 1 }, '*');
    });
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.FlashcardsDesktop.player.status), 'playing');
    assert.match(await page.locator('#player-window-status').textContent(), /Playing: Alpha Anthem/);

    // The parent rejects messages that do not come from the player iframe.
    await page.evaluate(() => {
      window.postMessage({ channel: 'flashcards-player', type: 'error', message: 'spoof', cardId: 'alpha', instance: 1 }, '*');
    });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.FlashcardsDesktop.player.status), 'playing');
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('A card that becomes ready while minimized waits paused and resumes on restore', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
  try {
    await openDesktop(page, server.baseURL);
    await launchCard(page, 'slow');
    const frame = await waitForFrame(page, 'slow');
    // Minimize before the delayed metadata arrives.
    await page.click('.window[data-window-id="player"] .window-button.minimize');
    await page.waitForFunction(() => window.FlashcardsDesktop.player.status === 'paused');
    await frame.waitForFunction(() => window.FlashcardsPlayer && window.FlashcardsPlayer.state.metadataSeen);
    await frame.waitForFunction(() => window.__ruffleMock.calls.some((call) => call.method === 'suspend'));
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.FlashcardsDesktop.player.status), 'paused');
    assert.equal(await page.evaluate(() => window.FlashcardsDesktop.player.playing), false);
    let calls = await callsOf(frame);
    assert.ok(calls.some((call) => call.method === 'suspend'));
    assert.equal(calls.some((call) => call.method === 'resume'), false);

    await page.click('.task-button:has-text("Slow Loader")');
    await frame.waitForFunction(() => window.__ruffleMock.calls.some((call) => call.method === 'resume'));
    await page.waitForFunction(() => window.FlashcardsDesktop.player.status === 'playing');
    calls = await callsOf(frame);
    assert.ok(calls.some((call) => call.method === 'resume'), 'restoring resumes the pending card');
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Standalone player.html gates playback behind an explicit Start card click', async () => {
  const page = await newPage(browser, { viewport: { width: 1000, height: 760 } });
  try {
    await page.goto(server.baseURL + '/player.html?card=alpha');
    await page.waitForSelector('#start-panel:visible');
    assert.equal(await page.evaluate(() => window.FlashcardsPlayer.state.awaitingStart), true);
    assert.equal(await page.evaluate(() => window.FlashcardsPlayer.state.embedded), false);
    assert.match(await page.locator('#start-detail').textContent(), /Click the stage to begin\./);
    assert.equal(await page.locator('ruffle-player, .mock-ruffle-player').count(), 0);

    // Nothing is loaded or started until the gate is used.
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => (window.__ruffleMock ? window.__ruffleMock.calls : []));
    assert.equal(before.some((call) => call.method === 'load'), false);
    assert.equal(await page.evaluate(() => window.FlashcardsPlayer.state.metadataSeen), false);

    await page.click('#start-card-button');
    await page.waitForFunction(() => window.FlashcardsPlayer.state.metadataSeen === true);
    assert.equal(await page.evaluate(() => window.FlashcardsPlayer.state.awaitingStart), false);
    const calls = await page.evaluate(() => window.__ruffleMock.calls);
    assert.equal(calls.filter((call) => call.method === 'load').length, 1);
    assert.equal(await page.locator('#start-panel').isVisible(), false);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Closing the player window releases the iframe and its audio', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 860 } });
  try {
    await openDesktop(page, server.baseURL);
    await launchCard(page, 'alpha');
    await waitForPlayerStatus(page, 'playing');
    assert.equal(await page.locator('iframe').count(), 1);

    await page.click('.window[data-window-id="player"] .window-button.close');
    assert.equal(await page.locator('iframe').count(), 0);
    await waitForDestroyed(page, 1);
    assert.equal(await destroyedCount(page) >= 1, true);
    assert.equal(await page.evaluate(() => window.FlashcardsDesktop.player.frameCount), 0);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});
