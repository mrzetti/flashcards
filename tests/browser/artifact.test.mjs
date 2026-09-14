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

test('Artifact cards open a files window with preview, downloads and gallery', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL, '/?card=artifact');
    await page.waitForSelector('[data-card-id="artifact"]');

    const details = page.locator('.details-content');
    assert.match(await details.textContent(), /Screensaver Artifact/);
    assert.match(await details.textContent(), /1 download/);
    assert.match(await details.textContent(), /Fixture bundle/);

    const launch = page.locator('.details-actions button', { hasText: 'Open files & preview' });
    assert.equal(await launch.isVisible(), true);
    await launch.click();

    await page.waitForSelector('.window[data-window-id="artifact"]');
    const artifactWindow = page.locator('.window[data-window-id="artifact"]');
    assert.match(await artifactWindow.locator('.window-title').textContent(), /Files & Preview/);
    assert.equal(await artifactWindow.locator('.artifact-frame').count(), 1);
    assert.equal(await artifactWindow.locator('.download-link').first().textContent(), 'Fixture bundle');
    assert.match(await artifactWindow.locator('.download-meta').first().textContent(), /1 KB/);
    assert.equal(await artifactWindow.locator('.gallery-item').count(), 1);
    assert.match(await artifactWindow.locator('.gallery-item figcaption').textContent(), /Fixture gallery image/);

    // The sprite preview runs in the iframe and uses the extracted scene.
    const frame = page.frames().find((candidate) => candidate.url().includes('screensaver.html'));
    assert.ok(frame, 'preview iframe is present');
    await frame.waitForFunction(() => window.__screensaverPreview && window.__screensaverPreview.ready);
    assert.ok(await frame.locator('.screensaver-sprite').count() >= 2, 'preview animates the extracted sprites');
    assert.equal(await frame.locator('.screensaver-frame').isVisible(), true);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Artifact cards never start the Ruffle player', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  try {
    await openDesktop(page, server.baseURL);
    await page.evaluate(() => window.FlashcardsDesktop.launch('artifact'));
    await page.waitForSelector('.window[data-window-id="artifact"]');
    assert.equal(await page.locator('.window[data-window-id="player"]').count(), 0);
    assert.equal(await page.locator('.player-stage-holder iframe').count(), 0);
    assert.equal(await page.locator('iframe[src*="player.html"]').count(), 0);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});
