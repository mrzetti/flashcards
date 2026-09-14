/*
 * Real-runtime verification for the Mutter Enhanced CD artifact card.
 *
 *   FLASHCARDS_URL=http://127.0.0.1:4173/ node qa/mutter-ecd-verify.cjs
 *
 * Loads the real catalog in Chromium, opens the artifact window, exercises the
 * Universal Media Player preview (media paging, the labelled Sonne transcode,
 * the extracted manual), and captures screenshots plus a JSON result file.
 * This is a maintenance tool; it is not part of the deployed site.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const base = process.env.FLASHCARDS_URL || 'https://flashcards.rammwiki.mrzetti.com/';
const output = process.env.QA_OUTPUT || '/tmp/opencode/flashcards-mutter-ecd';
const CARD_ID = '2001-mutter-enhanced-cd';
fs.mkdirSync(output, { recursive: true });

async function openPreview(page, screenshotName) {
  await page.goto(new URL('?card=' + CARD_ID, base).href);
  await page.waitForFunction(() => window.FlashcardsDesktop?.catalogStatus === 'ready');
  assert.equal(await page.locator('iframe').count(), 0, 'deep link selects without launching');
  if (screenshotName) await page.screenshot({ path: path.join(output, screenshotName) });
  await page.locator('.tile-launch[aria-label="Launch Mutter — Enhanced CD"]').click();
  await page.waitForSelector('.window[data-window-id="artifact"]');
  const frame = page.frames().find((candidate) => candidate.url().includes('mutter-ecd.html'));
  assert.ok(frame, 'preview iframe is present');
  await frame.waitForFunction(() => window.__mutterEcdPreview && window.__mutterEcdPreview.ready);
  await frame.waitForFunction(() => window.__mutterEcdPreview.discLoaded === true);
  return frame;
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const result = { base, checks: [], errors: [], failedRequests: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => result.errors.push(error.message));
    page.on('requestfailed', (request) => result.failedRequests.push(request.url()));

    const frame = await openPreview(page, 'desktop-catalog.png');
    result.checks.push('deep link + explicit launch open the files window');

    const windowInfo = await page.evaluate(() => ({
      downloads: document.querySelectorAll('.window[data-window-id="artifact"] .download-link').length,
      gallery: document.querySelectorAll('.window[data-window-id="artifact"] .gallery-item').length,
      headings: Array.from(document.querySelectorAll('.window[data-window-id="artifact"] .artifact-heading'))
        .map((heading) => heading.textContent),
    }));
    assert.equal(windowInfo.downloads, 8, 'eight downloads listed');
    assert.equal(windowInfo.gallery, 7, 'seven gallery items listed');
    assert.ok(windowInfo.headings.includes('Extracted disc files'), 'per-card gallery heading');
    result.checks.push('downloads, gallery and per-card gallery heading render');
    await page.screenshot({ path: path.join(output, 'desktop-files.png') });

    // The media panel comes from the disc's own files.
    await frame.waitForFunction(() => document.getElementById('ump-image').naturalWidth > 0);
    const media = await frame.evaluate(() => ({
      image: document.getElementById('ump-image').getAttribute('src'),
      caption: document.getElementById('ump-image-caption').textContent,
      tracks: window.__mutterEcdPreview.tracks(),
      links: window.__mutterEcdPreview.links(),
      album: window.__mutterEcdPreview.album(),
      artist: window.__mutterEcdPreview.artist(),
    }));
    assert.equal(media.tracks.length, 11);
    assert.equal(media.tracks[0], 'Mein Herz Brennt');
    assert.equal(media.links.length, 3);
    assert.equal(media.album, 'Mutter');
    assert.equal(media.artist, 'Rammstein');
    result.checks.push('AUTORUN.INF supplies album, artist, 11 tracks and 3 links');
    result.disc = { album: media.album, artist: media.artist, tracks: media.tracks.length, links: media.links.length };
    await page.screenshot({ path: path.join(output, 'desktop-media.png') });

    // Last/Next image paging.
    const firstImage = media.image;
    await frame.locator('.ump-tool[data-image="next"]').click();
    const secondImage = await frame.evaluate(() => document.getElementById('ump-image').getAttribute('src'));
    assert.notEqual(firstImage, secondImage);
    result.checks.push('Last/Next image page through the disc artwork');

    // The labelled browser transcode actually plays.
    await frame.locator('.ump-tool[data-panel="video"]').click();
    await frame.waitForFunction(() => {
      const video = document.getElementById('ump-video');
      return video && video.readyState >= 1 && video.duration > 0;
    }, null, { timeout: 20000 });
    const codec = await frame.evaluate(() =>
      document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'));
    await frame.evaluate(() => document.getElementById('ump-video').play());
    await frame.waitForFunction(() => document.getElementById('ump-video').currentTime > 1, null, { timeout: 20000 });
    const video = await frame.evaluate(() => {
      const element = document.getElementById('ump-video');
      element.pause();
      return {
        duration: Math.round(element.duration * 10) / 10,
        width: element.videoWidth,
        height: element.videoHeight,
        currentTime: Math.round(element.currentTime * 10) / 10,
        src: element.querySelector('source').getAttribute('src'),
      };
    });
    assert.ok(video.duration > 235 && video.duration < 245, 'four-minute video');
    assert.equal(video.width, 352);
    // Chromium reports the display size after the MPEG-1 pixel aspect ratio
    // (352x240 at SAR 200:219), so the height lands slightly above 240.
    assert.ok(Math.abs(video.width / video.height - 880 / 657) < 0.01, 'preserved aspect ratio');
    assert.match(video.src, /sonne-preview\.mp4$/);
    result.video = { codec, ...video };
    result.checks.push('Sonne transcode decodes and plays past 1 s in Chromium');
    await page.screenshot({ path: path.join(output, 'desktop-video.png') });

    // Help/Prefs shows the extracted manual and credits.
    await frame.locator('.ump-tool[data-panel="help"]').click();
    await frame.waitForFunction(() =>
      document.getElementById('ump-manual').textContent.includes('Thinking Pictures'));
    result.checks.push('Help/Prefs loads the ReadThis.WRI extraction');
    await page.screenshot({ path: path.join(output, 'desktop-help.png') });

    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.failedRequests, []);
    result.checks.push('no page errors or failed requests');
    await context.close();

    // Phone-emulated layout: window fills the desktop, no horizontal overflow.
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobile.newPage();
    mobilePage.on('pageerror', (error) => result.errors.push('mobile: ' + error.message));
    const mobileFrame = await openPreview(mobilePage, 'mobile-catalog.png');
    const overflow = await mobileFrame.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1, 'no horizontal overflow');
    result.checks.push('390x844 preview has no horizontal overflow');
    await mobilePage.screenshot({ path: path.join(output, 'mobile-preview.png') });
    await mobile.close();

    result.ok = true;
  } catch (error) {
    result.ok = false;
    result.error = error && error.stack ? error.stack : String(error);
  } finally {
    fs.writeFileSync(path.join(output, 'mutter-ecd-results.json'), JSON.stringify(result, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
})();
