const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.FLASHCARDS_URL || 'https://flashcards.rammwiki.mrzetti.com/';
const output = process.env.QA_OUTPUT || '/tmp/opencode/flashcards-runtime';
const ids = process.argv.slice(2);
if (!ids.length) throw new Error('Supply card IDs to capture');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await context.addInitScript({ path: path.join(__dirname, 'audio-probe.js') });
  const results = [];
  for (const id of ids) {
    const page = await context.newPage();
    await page.addLocatorHandler(page.locator('#hardware-acceleration-modal:not(.hidden)'), async () => {
      await page.locator('#hardware-acceleration-modal .close-modal').click();
    });
    const result = { id, errors: [], failed: [], external: [], audio: [] };
    page.on('pageerror', e => result.errors.push(e.message));
    page.on('requestfailed', r => result.failed.push({ url: r.url(), error: r.failure() }));
    page.on('response', r => { if (r.status() >= 400) result.failed.push({ url: r.url(), status: r.status() }); });
    page.on('request', r => { if (new URL(r.url()).origin !== new URL(base).origin) result.external.push(r.url()); });
    await page.goto(new URL('player.html?card=' + id, base).href);
    await page.waitForTimeout(1000);
    if (await page.locator('#start-card-button').isVisible()) await page.locator('#start-card-button').click();
    await page.waitForTimeout(6000);
    const stage = page.locator('#stage');
    const box = await stage.boundingBox();
    const accelerationClose = page.locator('#hardware-acceleration-modal .close-modal');
    if (await accelerationClose.isVisible()) await accelerationClose.click();
    const unmute = page.locator('#unmute-overlay');
    if (await unmute.isVisible()) await unmute.click({ delay: 150 });
    await page.waitForTimeout(7000);
    await page.screenshot({ path: path.join(output, id + '.png') });
    result.stage = box;
    result.state = await page.evaluate(() => window.FlashcardsPlayer?.state);
    for (let i = 0; i < 6; i++) {
      result.audio.push(await page.evaluate(() => window.__audioAudit?.()));
      await page.waitForTimeout(150);
    }
    result.text = await page.locator('body').innerText();
    results.push(result);
    await page.close();
  }
  fs.writeFileSync(path.join(output, 'capture.json'), JSON.stringify(results, null, 2));
  await browser.close();
})();
