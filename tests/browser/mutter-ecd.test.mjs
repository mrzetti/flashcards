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

test('Mutter Enhanced CD preview reads the disc files and switches panels', async () => {
  const page = await newPage(browser, { viewport: { width: 1280, height: 900 } });
  try {
    await openDesktop(page, server.baseURL, '/?card=ecd');
    await page.waitForSelector('[data-card-id="ecd"]');

    const launch = page.locator('.details-actions button', { hasText: 'Open files & preview' });
    await launch.click();
    await page.waitForSelector('.window[data-window-id="artifact"]');

    const frame = page.frames().find((candidate) => candidate.url().includes('mutter-ecd.html'));
    assert.ok(frame, 'ECD preview iframe is present');
    await frame.waitForFunction(() => window.__mutterEcdPreview && window.__mutterEcdPreview.ready);
    // AUTORUN.INF is read from the preserved disc files.
    await frame.waitForFunction(() => window.__mutterEcdPreview.discLoaded === true);

    const tracks = await frame.evaluate(() => window.__mutterEcdPreview.tracks());
    assert.equal(tracks.length, 11);
    assert.equal(tracks[0], 'Mein Herz Brennt');
    assert.equal(await frame.locator('.ump-tracks li').count(), 11);
    assert.equal(await frame.locator('.ump-links li').count(), 3);

    // Media panel starts on the first image and Last/Next page through them.
    assert.equal(await frame.evaluate(() => window.__mutterEcdPreview.imageIndex()), 0);
    await frame.locator('.ump-tool[data-image="next"]').click();
    assert.equal(await frame.evaluate(() => window.__mutterEcdPreview.imageIndex()), 1);
    assert.match(await frame.locator('#ump-image-caption').textContent(), /FrontMed/);
    await frame.locator('.ump-tool[data-image="prev"]').click();
    assert.equal(await frame.evaluate(() => window.__mutterEcdPreview.imageIndex()), 0);

    // The video panel lazily points at the labelled browser transcode.
    await frame.locator('.ump-tool[data-panel="video"]').click();
    assert.equal(await frame.locator('#ump-video').isVisible(), true);
    assert.match(await frame.locator('#ump-video source').getAttribute('src'), /sonne-preview\.mp4$/);

    // Help/Prefs loads the manual extracted from ReadThis.WRI.
    await frame.locator('.ump-tool[data-panel="help"]').click();
    await frame.waitForFunction(() =>
      document.getElementById('ump-manual').textContent.includes('Universal Media Player'));
    assert.match(await frame.locator('#ump-manual').textContent(), /Thinking Pictures/);

    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test('Mutter Enhanced CD preview has no horizontal overflow on a phone layout', async () => {
  const page = await newPage(browser, { viewport: { width: 390, height: 844 } });
  try {
    await openDesktop(page, server.baseURL, '/?card=ecd');
    await page.evaluate(() => window.FlashcardsDesktop.launch('ecd'));
    await page.waitForSelector('.window[data-window-id="artifact"]');
    const frame = page.frames().find((candidate) => candidate.url().includes('mutter-ecd.html'));
    assert.ok(frame, 'ECD preview iframe is present');
    await frame.waitForFunction(() => window.__mutterEcdPreview && window.__mutterEcdPreview.ready);
    const overflow = await frame.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1,
      `no horizontal overflow: ${overflow.scrollWidth} <= ${overflow.clientWidth}`);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});
