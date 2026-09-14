import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  focusWindow,
  launchBrowser,
  launchCard,
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

function embedFrame(page, marker = '/fixtures/embed.html') {
  return page.frames().find((frame) => frame.url().includes(marker));
}

test('Embed cards launch in one browser-game window without Ruffle', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL);
    assert.equal(await page.evaluate(() => window.crossOriginIsolated), true, 'desktop is cross-origin isolated');
    assert.equal(
      await page.locator('[data-card-id="embed"] .tile-meta').textContent(),
      'Browser game · 1997 · 640×480',
    );

    await launchCard(page, 'embed');
    await page.waitForSelector('.window[data-window-id="embed"]');
    const embedWindow = page.locator('.window[data-window-id="embed"]');
    assert.match(await embedWindow.locator('.window-title').textContent(), /Browser game/);
    assert.equal(await embedWindow.locator('.embed-frame').count(), 1);
    assert.match(await embedWindow.locator('.embed-note').textContent(), /127\.0\.0\.1/);
    assert.match(await embedWindow.locator('.embed-note').textContent(), /Load game/);

    // The fixture game runs in its own document; the desktop hosts no Ruffle player.
    const frame = embedFrame(page);
    assert.ok(frame, 'embed iframe is present');
    await frame.waitForSelector('#load');
    assert.equal(await frame.locator('#state').textContent(), 'not loaded');
    await frame.click('#load');
    await frame.waitForFunction(() => window.__embedFixture && window.__embedFixture.loaded);
    assert.equal(await frame.locator('#state').textContent(), 'loaded one');

    assert.equal(await page.locator('.window[data-window-id="player"]').count(), 0);
    assert.equal(await page.locator('iframe[src*="player.html"]').count(), 0);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Launching another embed card reuses the window and replaces the frame', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL);
    await launchCard(page, 'embed');
    await page.waitForSelector('.window[data-window-id="embed"] .embed-frame');
    await page.waitForFunction(() => {
      const frame = document.querySelector('.window[data-window-id="embed"] .embed-frame');
      return Boolean(frame && frame.contentWindow);
    });

    await focusWindow(page, 'explorer', 'RammWiki Flashcards');
    await page.click('[data-card-id="embed-alt"] .tile-launch');

    await page.waitForFunction(() => {
      const frame = document.querySelector('.window[data-window-id="embed"] .embed-frame');
      return Boolean(frame && frame.src.includes('game=two'));
    });
    assert.equal(await page.locator('.window[data-window-id="embed"]').count(), 1);
    assert.equal(await page.locator('.embed-frame').count(), 1);
    const stale = page.frames().some((frame) => frame.url().endsWith('/fixtures/embed.html'));
    assert.equal(stale, false, 'the previous game document was released');

    // Launching the same card again just focuses the running window.
    const before = await page.locator('.embed-frame').getAttribute('src');
    await focusWindow(page, 'explorer', 'RammWiki Flashcards');
    await page.click('[data-card-id="embed-alt"] .tile-launch');
    assert.equal(await page.locator('.embed-frame').getAttribute('src'), before);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Closing the browser-game window releases its frame', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL);
    await launchCard(page, 'embed');
    await page.waitForSelector('.window[data-window-id="embed"] .embed-frame');
    await page.click('.window[data-window-id="embed"] .window-button.close');
    await page.waitForFunction(() => !document.querySelector('.window[data-window-id="embed"]'));
    assert.equal(await page.locator('iframe[src*="/fixtures/embed.html"]').count(), 0);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Embed deep links select the card but never start the game', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL, '/?card=embed');
    const tile = page.locator('[data-card-id="embed"]');
    assert.equal(await tile.getAttribute('aria-selected'), 'true');
    assert.match(await page.locator('.details-content').textContent(), /Embedded Game/);
    assert.match(await page.locator('.details-content').textContent(), /original game runs on its own site/i);
    const launch = page.locator('.details-actions button', { hasText: 'Launch game' });
    assert.equal(await launch.isEnabled(), true);
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await page.locator('.window[data-window-id="embed"]').count(), 0);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Embed cards without a usable URL cannot launch', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL);
    const card = await page.evaluate(() => {
      const catalog = window.FlashcardsCore.sanitizeCatalog({
        cards: [
          { id: 'no-url', title: 'No URL Game', kind: 'embed', status: 'Playable', instructions: 'x' },
          { id: 'bad-url', title: 'Bad URL Game', kind: 'embed', url: 'javascript:alert(1)', status: 'Playable', instructions: 'x' },
        ],
      });
      return catalog.cards.map((entry) => ({
        id: entry.id,
        url: entry.url,
        launchable: Boolean(window.FlashcardsCore.resolveEmbedUrl(entry.url, document.baseURI)),
      }));
    });
    assert.deepEqual(card, [
      { id: 'no-url', url: '', launchable: false },
      { id: 'bad-url', url: 'javascript:alert(1)', launchable: false },
    ]);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});
