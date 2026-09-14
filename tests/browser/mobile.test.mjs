import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  frameFor,
  launchBrowser,
  launchCard,
  newPage,
  openDesktop,
  startTestServer,
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

const MOBILE = {
  viewport: { width: 390, height: 764 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
};

test('Mobile layout fills windows, keeps the desktop bounded and switches with the taskbar', async () => {
  const page = await newPage(browser, MOBILE);
  try {
    await openDesktop(page, server.baseURL);

    const state = await page.evaluate(() => window.FlashcardsDesktop.windows.find((w) => w.id === 'explorer'));
    assert.equal(await page.locator('.window[data-window-id="explorer"].window--compact').count(), 1);
    const area = await page.evaluate(() => {
      const rect = document.getElementById('desktop').getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });
    assert.ok(state.bounds.width >= area.width - 2 && state.bounds.height >= area.height - 2);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1));

    // Resize handles are hidden on compact windows.
    assert.equal(await page.locator('.window[data-window-id="explorer"] .resize-handle:visible').count(), 0);

    // Tap a tile to select it, then launch it with the explicit play button.
    await page.locator('[data-card-id="beta"]').tap();
    assert.match(await page.locator('.details-content').textContent(), /Beta Racer/);
    assert.equal(await page.locator('iframe').count(), 0);
    await launchCard(page, 'beta');
    await waitForPlayerStatus(page, 'playing');
    assert.equal(await page.locator('.player-stage-holder iframe').count(), 1);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Touch keyboard appears only for the keys a card needs', async () => {
  const page = await newPage(browser, MOBILE);
  try {
    await openDesktop(page, server.baseURL);

    // Beta needs the four arrow keys plus Space.
    await launchCard(page, 'beta');
    await waitForPlayerStatus(page, 'playing');
    let frame = frameFor(page, 'beta');
    await frame.waitForSelector('#touch-controls:visible');
    assert.equal(await frame.locator('#touch-controls button').count(), 5);
    assert.deepEqual(
      await frame.locator('#touch-controls button').evaluateAll((buttons) => buttons.map((button) => button.dataset.key)),
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'],
    );
    assert.equal(await frame.locator('#touch-toggle').isVisible(), true);

    // Tapping a key sends one keydown and one keyup with the right key code.
    await frame.locator('[data-key="ArrowLeft"]').tap();
    await frame.waitForFunction(() => window.__ruffleMock.calls.some((call) => call.method === 'key' && call.code === 'ArrowLeft'));
    let calls = await frame.evaluate(() => window.__ruffleMock.calls);
    let leftCalls = calls.filter((call) => call.method === 'key' && call.code === 'ArrowLeft');
    assert.equal(leftCalls.filter((call) => call.type === 'keydown').length, 1);
    assert.equal(leftCalls.filter((call) => call.type === 'keyup').length, 1);
    assert.equal(leftCalls[0].keyCode, 37);

    // Holding a touch key keeps it pressed until release (native touch contact),
    // even if focus moves into Ruffle while the finger is still down.
    const cdp = await page.context().newCDPSession(page);
    const box = await frame.locator('[data-key="ArrowRight"]').boundingBox();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 7 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.waitForTimeout(120);
    assert.equal(await frame.locator('[data-key="ArrowRight"].held').count(), 1);
    await frame.evaluate(() => {
      const button = document.querySelector('[data-key="ArrowRight"]');
      button.focus();
      button.blur();
    });
    assert.equal(await frame.locator('[data-key="ArrowRight"].held').count(), 1, 'blur does not cancel a pointer hold');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await frame.locator('[data-key="ArrowRight"].held').count(), 0);
    calls = await frame.evaluate(() => window.__ruffleMock.calls);
    const rightCalls = calls.filter((call) => call.method === 'key' && call.code === 'ArrowRight');
    assert.equal(rightCalls.filter((call) => call.type === 'keydown').length, 1);
    assert.equal(rightCalls.filter((call) => call.type === 'keyup').length, 1);

    // Mouse-only card: no touch keyboard, no toggle.
    await launchCard(page, 'mouse');
    await waitForPlayerStatus(page, 'playing');
    frame = frameFor(page, 'mouse');
    assert.equal(await frame.locator('#touch-controls').isVisible(), false);
    assert.equal(await frame.locator('#touch-toggle').isVisible(), false);

    // Keyboard card: exactly the two keys listed in the catalog.
    await launchCard(page, 'kbd');
    await waitForPlayerStatus(page, 'playing');
    frame = frameFor(page, 'kbd');
    await frame.waitForSelector('#touch-controls:visible');
    assert.deepEqual(
      await frame.locator('#touch-controls button').evaluateAll((buttons) => buttons.map((button) => button.dataset.key)),
      ['ArrowLeft', 'ArrowRight'],
    );
    assert.equal(await page.locator('.player-stage-holder iframe').count(), 1, 'still one player at a time');
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Touch controls can be toggled off and release keys on page hide', async () => {
  const page = await newPage(browser, MOBILE);
  try {
    await openDesktop(page, server.baseURL);
    await launchCard(page, 'beta');
    await waitForPlayerStatus(page, 'playing');
    const frame = frameFor(page, 'beta');
    await frame.waitForSelector('#touch-controls:visible');

    const cdp = await page.context().newCDPSession(page);
    const box = await frame.locator('[data-key="ArrowUp"]').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 3 }],
    });
    assert.equal(await frame.locator('[data-key="ArrowUp"].held').count(), 1);

    await frame.locator('#touch-toggle').tap();
    assert.equal(await frame.locator('#touch-controls').isVisible(), false);
    assert.equal(await frame.locator('#touch-toggle').getAttribute('aria-pressed'), 'false');

    await frame.locator('#touch-toggle').tap();
    assert.equal(await frame.locator('#touch-controls').isVisible(), true);
    assert.equal(await frame.locator('#touch-toggle').getAttribute('aria-pressed'), 'true');

    // Keyboard activation of a touch key holds until Space is released:
    // focus moves into the player (required for Ruffle to receive keys) and
    // must not cancel the hold.
    await frame.locator('[data-key="ArrowUp"]').focus();
    await page.keyboard.down(" ");
    assert.equal(await frame.locator('[data-key="ArrowUp"].held').count(), 1);
    assert.equal(
      await frame.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-mock-player')),
      'beta',
      'focus moved to the player so Ruffle receives the synthetic key',
    );
    await frame.evaluate(() => document.activeElement.blur());
    assert.equal(await frame.locator('[data-key="ArrowUp"].held').count(), 1, 'blur does not cancel a keyboard hold');
    await page.keyboard.up(" ");
    assert.equal(await frame.locator('[data-key="ArrowUp"].held').count(), 0);

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});
