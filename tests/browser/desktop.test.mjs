import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  launchBrowser,
  newPage,
  openDesktop,
  startTestServer,
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

test('Explorer renders the catalog, filters by search and shows placeholder thumbnails', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL);
    await page.waitForSelector('[data-card-id="mouse"] .tile-fallback');

    assert.equal(await page.locator('.card-tile').count(), 10);
    assert.equal(await page.locator('.task-pane, [data-filter]').count(), 0);
    assert.match(await page.locator('#status-count').textContent(), /10 cards/);
    assert.match(await page.locator('#clock').textContent(), /^\d{1,2}:\d{2} (AM|PM)$/);

    // Short, explicit status labels; the full catalog text stays in the pane.
    assert.equal(await page.locator('[data-card-id="alpha"] .status-badge').textContent(), 'Playable');
    assert.equal(await page.locator('[data-card-id="alpha"] .status-badge').getAttribute('title'), 'Verified playback');
    assert.equal(await page.locator('[data-card-id="kbd"] .status-badge').textContent(), 'Partial');
    assert.equal(await page.locator('[data-card-id="mouse"] .status-badge').textContent(), 'Unverified');
    assert.equal(await page.locator('[data-card-id="broken"] .status-badge').textContent(), 'Unsupported');
    assert.equal(await page.locator('[data-card-id="slow"] .status-badge').textContent(), 'Unknown');

    await page.fill('#card-search', 'racer');
    assert.equal(await page.locator('.card-tile').count(), 1);
    assert.equal(await page.locator('.card-tile').getAttribute('data-card-id'), 'beta');
    assert.match(await page.locator('#explorer .explorer-status').textContent(), /Showing 1 of 10 cards/);

    await page.fill('#card-search', 'nothing-matches-this');
    assert.equal(await page.locator('.card-tile').count(), 0);
    assert.match(await page.locator('#explorer .explorer-status').textContent(), /No cards match/);

    await page.fill('#card-search', '');
    assert.equal(await page.locator('.card-tile').count(), 10);

    // The unverified card keeps its raw catalog detail in the pane.
    await page.click('[data-card-id="mouse"]');
    assert.match(await page.locator('.details-content').textContent(), /Not runtime-verified/);
    assert.match(await page.locator('.details-content').textContent(), /has not been runtime-verified yet/);

    // Missing SWF entries can be selected but never launched.
    await page.click('[data-card-id="nofile"]');
    assert.match(await page.locator('.details-content').textContent(), /No SWF file is listed/);
    assert.equal(await page.locator('.details-actions button').first().isDisabled(), true);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Deep links select a card and offer launch without creating a player', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL, '/?card=beta');

    const tile = page.locator('[data-card-id="beta"]');
    assert.equal(await tile.getAttribute('aria-selected'), 'true');
    assert.equal(await tile.locator('.status-badge').textContent(), 'Playable');
    assert.equal(await tile.locator('.status-badge').getAttribute('title'), 'Verified playback');
    assert.match(await page.locator('.details-content').textContent(), /Beta Racer/);
    assert.match(await page.locator('.details-content').textContent(), /Verified playback/);
    assert.match(await page.locator('#explorer .explorer-status').textContent(), /selected from the link/i);
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await page.locator('.window[data-window-id="player"]').count(), 0);
    assert.equal(new URL(page.url()).searchParams.get('card'), 'beta');

    // The launch button is present and is the only way to start the card.
    const launchButton = page.locator('.details-actions button', { hasText: 'Launch card' });
    assert.equal(await launchButton.isVisible(), true);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Initial Explorer is centred on large desktops with the icon column visible', async () => {
  const page = await newPage(browser, { viewport: { width: 1600, height: 1000 } });
  try {
    await openDesktop(page, server.baseURL);
    const bounds = await page.evaluate(() => window.FlashcardsDesktop.windows.find((w) => w.id === 'explorer').bounds);
    const area = await page.evaluate(() => {
      const rect = document.getElementById('desktop').getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });
    assert.equal(bounds.width, 1100);
    assert.equal(bounds.height, 720);
    assert.ok(Math.abs((bounds.x + bounds.width / 2) - area.width / 2) <= 1, 'window is horizontally centred');
    assert.ok(Math.abs((bounds.y + bounds.height / 2) - area.height / 2) <= 1, 'window is vertically centred');
    assert.ok(bounds.x >= 120, 'the desktop icon column stays clear');

    // The desktop shortcut sits beside the window, not underneath it.
    const icon = await page.locator('.desktop-icon').first().boundingBox();
    assert.ok(icon.x + icon.width <= bounds.x + 1, `icon ends at ${icon.x + icon.width}, window starts at ${bounds.x}`);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Unknown deep-link ids are reported without a player', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL, '/?card=does-not-exist');
    await page.waitForSelector('#explorer .explorer-status');
    assert.match(await page.locator('#explorer .explorer-status').textContent(), /no card with the id/i);
    assert.equal(await page.locator('iframe').count(), 0);
  } finally {
    await page.close();
  }
});

test('Windows minimize, restore, maximize, drag within bounds, resize with limits and close', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL);

    // Open the Help window from the Start menu.
    await page.click('#start-button');
    assert.equal(await page.getAttribute('#start-button', 'aria-expanded'), 'true');
    await page.click('#start-menu [data-action="help"]');
    await page.waitForSelector('.window[data-window-id="help"]');

    const helpSelector = '.window[data-window-id="help"]';
    const initialBounds = await page.evaluate(() => window.FlashcardsDesktop.windows.find((w) => w.id === 'help').bounds);
    assert.ok(initialBounds.width >= 320 && initialBounds.height >= 220);

    // Minimize: hidden, taskbar button released, window still on the taskbar.
    await page.click(`${helpSelector} .window-button.minimize`);
    assert.equal(await page.locator(`${helpSelector}.window--minimized`).count(), 1);
    assert.equal(await page.locator('.task-button[aria-label="Help and About"]').getAttribute('aria-pressed'), 'false');

    // Restore from the taskbar.
    await page.click('.task-button[aria-label="Help and About"]');
    assert.equal(await page.locator(`${helpSelector}.window--minimized`).count(), 0);
    assert.equal(await page.locator('.task-button[aria-label="Help and About"]').getAttribute('aria-pressed'), 'true');

    // Maximize fills the desktop; restoring returns to the previous bounds.
    await page.click(`${helpSelector} .window-button.maximize`);
    const maximized = await page.evaluate(() => window.FlashcardsDesktop.windows.find((w) => w.id === 'help'));
    const area = await page.evaluate(() => {
      const rect = document.getElementById('desktop').getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });
    assert.equal(maximized.maximized, true);
    assert.ok(Math.abs(maximized.bounds.width - area.width) <= 2);
    assert.ok(Math.abs(maximized.bounds.height - area.height) <= 2);

    await page.click(`${helpSelector} .window-button.maximize`);
    const restored = await page.evaluate(() => window.FlashcardsDesktop.windows.find((w) => w.id === 'help'));
    assert.equal(restored.maximized, false);
    assert.ok(Math.abs(restored.bounds.width - initialBounds.width) <= 2);
    assert.ok(Math.abs(restored.bounds.height - initialBounds.height) <= 2);

    // Drag far outside the desktop: bounds stay inside.
    const titleBox = await page.locator(`${helpSelector} .window-titlebar`).boundingBox();
    await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(titleBox.x + 3000, titleBox.y + 3000, { steps: 8 });
    await page.mouse.up();
    let dragged = await page.evaluate(() => window.FlashcardsDesktop.windows.find((w) => w.id === 'help').bounds);
    assert.ok(dragged.x >= 0 && dragged.y >= 0);
    assert.ok(dragged.x + dragged.width <= area.width + 1);
    assert.ok(dragged.y + dragged.height <= area.height + 1);

    // Resize beyond the desktop: clamped to the area.
    const se = await page.locator(`${helpSelector} .resize-handle[data-dir="se"]`).boundingBox();
    await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
    await page.mouse.down();
    await page.mouse.move(se.x + 3000, se.y + 3000, { steps: 8 });
    await page.mouse.up();
    let resized = await page.evaluate(() => window.FlashcardsDesktop.windows.find((w) => w.id === 'help').bounds);
    assert.ok(resized.width <= area.width + 1 && resized.height <= area.height + 1);

    // Resize far inward: the window keeps its minimum size.
    const nw = await page.locator(`${helpSelector} .resize-handle[data-dir="nw"]`).boundingBox();
    await page.mouse.move(nw.x + nw.width / 2, nw.y + nw.height / 2);
    await page.mouse.down();
    await page.mouse.move(nw.x + 3000, nw.y + 3000, { steps: 8 });
    await page.mouse.up();
    resized = await page.evaluate(() => window.FlashcardsDesktop.windows.find((w) => w.id === 'help').bounds);
    assert.ok(resized.width >= 320);
    assert.ok(resized.height >= 220);

    // Double-clicking the title bar toggles maximize.
    await page.dblclick(`${helpSelector} .window-titlebar`);
    assert.equal(await page.evaluate(() => window.FlashcardsDesktop.windows.find((w) => w.id === 'help').maximized), true);
    await page.dblclick(`${helpSelector} .window-titlebar`);
    assert.equal(await page.evaluate(() => window.FlashcardsDesktop.windows.find((w) => w.id === 'help').maximized), false);

    // Close: window and taskbar button disappear.
    await page.click(`${helpSelector} .window-button.close`);
    assert.equal(await page.locator(helpSelector).count(), 0);
    assert.equal(await page.locator('.task-button[aria-label="Help and About"]').count(), 0);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Spoofed player messages are ignored by the host', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL);
    await page.evaluate(() => {
      window.postMessage({ channel: 'flashcards-player', type: 'status', state: 'ready', cardId: 'alpha', instance: 1 }, '*');
      window.postMessage({ channel: 'flashcards-host', type: 'pause', instance: 1 }, '*');
    });
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.window[data-window-id="player"]').count(), 0);
    assert.equal(await page.locator('iframe').count(), 0);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Shutdown dialog opens and cancels without reloading', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL);
    await page.click('#start-button');
    await page.click('#start-menu [data-action="shutdown"]');
    await page.waitForSelector('#shutdown:not([hidden])');
    assert.match(await page.locator('.shutdown-box').textContent(), /Turn off computer/);
    await page.click('#shutdown-cancel');
    assert.equal(await page.locator('#shutdown').isVisible(), false);
    assert.equal(await page.locator('.window[data-window-id="explorer"]').count(), 1);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});
