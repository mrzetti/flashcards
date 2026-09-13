import { chromium } from 'playwright';
import { startServer } from '../server.mjs';

export const BROWSER_PATH = process.env.BROWSER_PATH || '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';

export async function startTestServer(options = {}) {
  return startServer(options);
}

export async function launchBrowser() {
  const executablePath = process.env.BROWSER_PATH || BROWSER_PATH;
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  };
  try {
    return await chromium.launch(executablePath ? { ...launchOptions, executablePath } : launchOptions);
  } catch (error) {
    // Fall back to Playwright's own browser resolution when the pinned path is absent.
    return chromium.launch(launchOptions);
  }
}

export async function newPage(browser, options = {}) {
  const page = await browser.newPage(options);
  page.errors = [];
  page.on('pageerror', (error) => page.errors.push(error.message));
  return page;
}

export async function openDesktop(page, baseURL, path = '/') {
  await page.goto(baseURL + path);
  await page.waitForSelector('.window[data-window-id="explorer"]');
  await page.waitForFunction(() => window.FlashcardsDesktop && window.FlashcardsDesktop.catalogStatus === 'ready');
  await page.waitForSelector('[data-card-id="alpha"]');
}

export function playerFrame(page) {
  return page.frames().find((frame) => frame.url().includes('player.html'));
}

export function frameFor(page, cardId) {
  return page.frames().find((frame) => {
    if (!frame.url().includes('player.html')) return false;
    try {
      return new URL(frame.url()).searchParams.get('card') === cardId;
    } catch (error) {
      return false;
    }
  });
}

export async function waitForFrame(page, cardId, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const frame = frameFor(page, cardId);
    if (frame) return frame;
    await page.waitForTimeout(50);
  }
  throw new Error(`Player frame for ${cardId} did not appear`);
}

export async function focusWindow(page, id, title) {
  const isActive = await page.evaluate((windowId) => {
    const element = document.querySelector(`.window[data-window-id="${windowId}"]`);
    return Boolean(element && element.classList.contains('window--active'));
  }, id);
  if (!isActive) {
    await page.click(`.task-button[aria-label="${title}"]`);
  }
}

export async function launchCard(page, id) {
  // The player window may cover the catalog; focus the Explorer first the same
  // way a user would, then use the explicit Launch button on the tile.
  await focusWindow(page, 'explorer', 'My Flashcards');
  await page.click(`[data-card-id="${id}"] .tile-launch`);
}

export async function waitForPlayerStatus(page, status, timeout = 15000) {
  await page.waitForFunction(
    (wanted) => window.FlashcardsDesktop && window.FlashcardsDesktop.player.status === wanted,
    status,
    { timeout },
  );
}

export async function playerCalls(page) {
  const frame = playerFrame(page);
  if (!frame) return [];
  return frame.evaluate(() => (window.__ruffleMock ? window.__ruffleMock.calls : []));
}

export async function destroyedCount(page) {
  return page.evaluate(() => Number(window.localStorage.getItem('flashcards.mock.destroyed') || '0'));
}

export async function waitForDestroyed(page, minimum, timeout = 5000) {
  await page.waitForFunction(
    (min) => Number(window.localStorage.getItem('flashcards.mock.destroyed') || '0') >= min,
    minimum,
    { timeout },
  );
}
