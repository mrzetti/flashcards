const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.FLASHCARDS_URL || 'https://flashcards.rammwiki.mrzetti.com/';
const out = '/tmp/opencode/flashcards-launcher';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const results = [];
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      isMobile: mobile, hasTouch: mobile,
    });
    await context.addInitScript({ path: path.join(__dirname, 'audio-probe.js') });
    const page = await context.newPage();
    const row = { mobile, pageErrors: [], checks: [] };
    page.on('pageerror', e => row.pageErrors.push(e.message));
    await page.goto(base + '?card=2005-benzin-game');
    await page.waitForFunction(() => window.FlashcardsDesktop?.catalogStatus === 'ready');
    assert.equal(await page.locator('iframe').count(), 0);
    row.checks.push('Deep link selects without creating a player');
    await page.screenshot({ path: path.join(out, mobile ? 'mobile-catalog.png' : 'desktop-catalog.png') });
    await page.locator('.tile-launch[aria-label="Launch Benzin Game"]').click();
    await page.waitForFunction(() => window.FlashcardsDesktop.player.status === 'playing');
    let frame = page.frames().find(f => f.url().includes('player.html'));
    assert(frame);
    const playerWindow = page.locator('.window').filter({ has: page.locator('iframe') });
    if (await frame.locator('#hardware-acceleration-modal .close-modal').isVisible()) {
      await frame.locator('#hardware-acceleration-modal .close-modal').click();
    }
    if (await frame.locator('#unmute-overlay').isVisible()) await frame.locator('#unmute-overlay').click({ delay: 150 });
    assert.equal(await page.locator('iframe').count(), 1);
    row.checks.push('Explicit launch creates one real Ruffle player');
    await page.screenshot({ path: path.join(out, mobile ? 'mobile-player.png' : 'desktop-player.png') });
    row.touchKeys = await frame.evaluate(() => window.FlashcardsPlayer.state.touchKeys);
    await frame.locator('#fullscreen-button').click();
    await page.waitForTimeout(400);
    assert.equal(await frame.evaluate(() => Boolean(document.fullscreenElement)), true);
    await frame.locator('#fullscreen-button').click();
    await page.waitForTimeout(400);
    assert.equal(await frame.evaluate(() => Boolean(document.fullscreenElement)), false);
    row.checks.push('Real fullscreen enters and exits through the toolbar');
    await playerWindow.locator('[data-window-action="minimize"]').click();
    await page.waitForTimeout(400);
    assert.equal(await frame.evaluate(() => window.FlashcardsPlayer.state.playing), false);
    row.checks.push('Minimize pauses actual Ruffle');
    await page.locator('.task-button').filter({ hasText: 'Benzin' }).click();
    await page.waitForTimeout(400);
    assert.equal(await frame.evaluate(() => window.FlashcardsPlayer.state.playing), true);
    row.checks.push('Taskbar restores/resumes player');
    if (!mobile) {
      await playerWindow.locator('[data-window-action="maximize"]').click();
      assert(await playerWindow.evaluate(e => e.classList.contains('window--maximized')));
      await playerWindow.locator('[data-window-action="maximize"]').click();
      const title = await playerWindow.locator('.window-titlebar').boundingBox();
      await page.mouse.move(title.x + 100, title.y + 12);
      await page.mouse.down();
      await page.mouse.move(1420, 970, { steps: 10 });
      await page.mouse.up();
      const bounds = await playerWindow.boundingBox();
      assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 1441 && bounds.y + bounds.height <= 965);
      row.checks.push('Maximize/restore and drag remain within desktop bounds');
    }
    await playerWindow.locator('[data-window-action="close"]').click();
    assert.equal(await page.locator('iframe').count(), 0);
    assert(frame.isDetached());
    row.checks.push('Close removes iframe and detaches execution context');
    await page.locator('.tile-launch[aria-label="Launch Benzin Game"]').click();
    await page.waitForFunction(() => window.FlashcardsDesktop.player.status === 'playing');
    const newFrame = page.frames().find(f => f.url().includes('player.html'));
    assert.notEqual(newFrame, frame);
    row.checks.push('Reopen creates a fresh execution context');
    await page.evaluate(() => window.FlashcardsDesktop.launch('2009-pussy'));
    assert(newFrame.isDetached());
    assert.equal(await page.locator('iframe').count(), 1);
    row.checks.push('Switch removes previous context; still exactly one player');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(row.pageErrors, []);
    results.push(row);
    await context.close();
  }
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(results, null, 2));
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})();
