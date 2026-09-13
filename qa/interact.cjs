const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../catalog.json').cards;
const out = '/tmp/opencode/flashcards-interactions';
fs.mkdirSync(out, { recursive: true });
const base = process.env.FLASHCARDS_URL || 'https://flashcards.rammwiki.mrzetti.com/';

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await context.addInitScript({ path: path.join(__dirname, 'audio-probe.js') });
  const results = [];
  for (const id of process.argv.slice(2)) {
    const card = catalog.find(c => c.id === id);
    const page = await context.newPage();
    const row = { id, failed: [], actions: [], dialogs: [] };
    page.setDefaultTimeout(20000);
    page.on('dialog', async dialog => { row.dialogs.push({ type: dialog.type(), message: dialog.message() }); await dialog.dismiss(); });
    page.on('response', r => { if (r.status() >= 400) row.failed.push({ url: r.url(), status: r.status() }); });
    page.on('requestfailed', r => row.failed.push({ url: r.url(), error: r.failure() }));
    await page.addLocatorHandler(page.locator('#hardware-acceleration-modal:not(.hidden)'), async () => {
      await page.locator('#hardware-acceleration-modal .close-modal').click();
    });
    await page.goto(new URL('player.html?card=' + id, base).href);
    await page.waitForTimeout(6500);
    if (await page.locator('#start-card-button').isVisible()) {
      await page.locator('#start-card-button').click();
      await page.waitForTimeout(6500);
    }
    if (await page.locator('#unmute-overlay').isVisible()) await page.locator('#unmute-overlay').click({ delay: 150 });
    async function point(x, y) {
      const b = await page.locator('#stage').boundingBox();
      const s = Math.min(b.width / card.width, b.height / card.height);
      return { x: b.x + (b.width - card.width * s) / 2 + x * s, y: b.y + (b.height - card.height * s) / 2 + y * s };
    }
    async function click(x, y, label) {
      const p = await point(x, y);
      await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(200);
      await page.mouse.click(p.x, p.y, { delay: 150 });
      row.actions.push({ label, x, y });
      await page.waitForTimeout(2200);
      await shot(label);
    }
    async function shot(label) { await page.screenshot({ path: path.join(out, id + '-' + label + '.png') }); }
    await page.waitForTimeout(6500);
    if (id === '2001-mutter') {
      await click(635, 384, 'skip');
      await click(555, 345, 'enter');
    } else if (id === '2001-ich-will') {
      await page.waitForTimeout(35000);
      for (let i = 0; i < 20; i++) {
        const p = await point(50 + i * 33, 70 + (i % 5) * 100);
        await page.mouse.move(p.x, p.y, { steps: 6 });
        await page.waitForTimeout(120);
      }
      await shot('pointer-movement');
      await page.waitForTimeout(6000);
      await shot('pointer-still');
      row.actions.push({ label: 'Moved pointer across stage then held still after intro' });
    } else if (id === '2002-mutter') {
      await click(70, 750, 'menu');
    } else if (id === '2005-benzin-game') {
      await click(540, 421, 'jouer-one');
      await click(110, 302, 'instructions');
      await click(474, 421, 'start-round');
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(3500);
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(2200);
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.up('ArrowUp');
      await shot('keyboard-drive');
    } else if (id === '2005-rosenrot-single') {
      await page.waitForTimeout(22000);
      await shot('newsletter');
      await click(500, 340, 'form-focus');
    } else if (id === '2009-pussy') {
      await page.waitForTimeout(12000);
      await click(345, 555, 'more');
    }
    row.audio = await page.evaluate(() => window.__audioAudit?.());
    await page.locator('#mute-button').click();
    await page.waitForTimeout(500);
    row.muted = { state: await page.evaluate(() => window.FlashcardsPlayer.state), audio: await page.evaluate(() => window.__audioAudit?.()) };
    await page.locator('#mute-button').click();
    await page.locator('#volume').fill('35');
    row.volume35 = await page.evaluate(() => window.FlashcardsPlayer.state);
    await page.locator('#fullscreen-button').click();
    await page.waitForTimeout(500);
    row.fullscreen = await page.evaluate(() => Boolean(document.fullscreenElement));
    await page.locator('#fullscreen-button').click();
    await page.locator('#restart-button').click();
    await page.waitForTimeout(2200);
    row.restarted = await page.evaluate(() => window.FlashcardsPlayer.state);
    await shot('restart');
    results.push(row);
    fs.writeFileSync(path.join(out, id + '.json'), JSON.stringify(row, null, 2));
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(results, null, 2));
    await page.close();
  }
  await browser.close();
})();
