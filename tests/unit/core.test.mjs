import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../../app.js');

test('clamp keeps values in range and falls back on garbage', () => {
  assert.equal(core.clamp(5, 0, 10), 5);
  assert.equal(core.clamp(-5, 0, 10), 0);
  assert.equal(core.clamp(50, 0, 10), 10);
  assert.equal(core.clamp('7', 0, 10), 7);
  assert.equal(core.clamp('nope', 3, 10), 3);
  assert.equal(core.clamp(NaN, 3, 10), 3);
});

test('clampWindowBounds fits windows inside the desktop and keeps them at the minimum size', () => {
  const area = { width: 1000, height: 600 };
  assert.deepEqual(
    core.clampWindowBounds({ x: 100, y: 50, width: 400, height: 300 }, area),
    { x: 100, y: 50, width: 400, height: 300, compact: false },
  );
  assert.deepEqual(
    core.clampWindowBounds({ x: 900, y: 580, width: 400, height: 300 }, area),
    { x: 600, y: 300, width: 400, height: 300, compact: false },
  );
  assert.deepEqual(
    core.clampWindowBounds({ x: -80, y: -20, width: 100, height: 80 }, area),
    { x: 0, y: 0, width: core.WINDOW_MIN_WIDTH, height: core.WINDOW_MIN_HEIGHT, compact: false },
  );
  assert.deepEqual(
    core.clampWindowBounds({ x: 10, y: 10, width: 5000, height: 5000 }, area),
    { x: 0, y: 0, width: 1000, height: 600, compact: false },
  );
});

test('clampWindowBounds fills the whole area in compact mode', () => {
  const bounds = core.clampWindowBounds({ x: 40, y: 90, width: 380, height: 500 }, { width: 390, height: 700 }, { compact: true });
  assert.deepEqual(bounds, { x: 0, y: 0, width: 390, height: 700, compact: true });
});

test('formatClock renders a 12-hour clock', () => {
  assert.equal(core.formatClock(new Date(2024, 0, 1, 0, 5)), '12:05 AM');
  assert.equal(core.formatClock(new Date(2024, 0, 1, 12, 0)), '12:00 PM');
  assert.equal(core.formatClock(new Date(2024, 0, 1, 9, 7)), '9:07 AM');
  assert.equal(core.formatClock(new Date(2024, 0, 1, 23, 59)), '11:59 PM');
  assert.equal(core.formatClock('not a date'), '--:--');
});

test('normalizeStatus maps catalog statuses onto short explicit categories', () => {
  assert.equal(core.normalizeStatus('Verified playback').key, 'playable');
  assert.equal(core.normalizeStatus('Verified playback').label, 'Playable');
  assert.equal(core.normalizeStatus('Playable').key, 'playable');
  assert.equal(core.normalizeStatus('works in Ruffle').key, 'playable');
  assert.equal(core.normalizeStatus('Partial — in-card navigation only').key, 'partial');
  assert.equal(core.normalizeStatus('Partial — in-card navigation only').label, 'Partial');
  assert.equal(core.normalizeStatus('limited support').key, 'partial');
  assert.equal(core.normalizeStatus('Unverified').key, 'unverified');
  assert.equal(core.normalizeStatus('Not runtime-verified').key, 'unverified');
  assert.equal(core.normalizeStatus('Unsupported').key, 'unsupported');
  assert.equal(core.normalizeStatus('broken file').key, 'unsupported');
  assert.equal(core.normalizeStatus('Missing').key, 'unsupported');
  assert.equal(core.normalizeStatus('').key, 'unknown');
  assert.equal(core.normalizeStatus('').label, 'Unknown');
  assert.equal(core.normalizeStatus(undefined).label, 'Unknown');
  assert.equal(core.normalizeStatus('Needs testing').key, 'unknown');
  assert.equal(core.normalizeStatus('Needs testing').label, 'Unknown');
  assert.equal(core.normalizeStatus('Needs testing').raw, 'Needs testing');
});

test('normalizeStatus never counts an unverified status as verified', () => {
  const vectors = [
    'Unverified',
    'Not runtime-verified',
    'Playable original SWF (not runtime-verified)',
    'Playable extracted SWF (not runtime-verified)',
    'runtime verification pending',
  ];
  for (const raw of vectors) {
    const status = core.normalizeStatus(raw);
    assert.equal(status.key, 'unverified', raw);
    assert.equal(status.label, 'Unverified', raw);
    assert.equal(status.raw, raw);
  }
  // Short raw statuses are kept for the details pane.
  assert.equal(core.normalizeStatus('Partial — some clips missing').raw, 'Partial — some clips missing');
});

test('matchesSearch checks every term across card metadata', () => {
  const card = core.sanitizeCard({
    id: 'beta',
    title: 'Beta Racer',
    year: 2002,
    description: 'Drive fast',
    instructions: 'Use the arrow keys',
    controls: ['Arrow keys', 'Space'],
  });
  assert.equal(core.matchesSearch(card, ''), true);
  assert.equal(core.matchesSearch(card, 'beta'), true);
  assert.equal(core.matchesSearch(card, 'RACER'), true);
  assert.equal(core.matchesSearch(card, '2002 drive'), true);
  assert.equal(core.matchesSearch(card, 'arrow space'), true);
  assert.equal(core.matchesSearch(card, 'gamma'), false);
  assert.equal(core.matchesSearch(card, 'beta gamma'), false);
  assert.equal(core.matchesSearch(null, 'beta'), false);
});

test('filterCards combines tone filters and search', () => {
  const catalog = core.sanitizeCatalog({
    cards: [
      { id: 'a', title: 'Alpha', status: 'Verified playback' },
      { id: 'b', title: 'Beta', status: 'Unsupported — broken' },
      { id: 'c', title: 'Gamma', status: 'Partial — glitches' },
      { id: 'd', title: 'Delta', status: 'Not runtime-verified' },
      { id: 'e', title: 'Epsilon' },
    ],
  });
  assert.equal(core.filterCards(catalog.cards, {}).length, 5);
  assert.deepEqual(core.filterCards(catalog.cards, { filter: 'playable' }).map((c) => c.id), ['a']);
  assert.deepEqual(core.filterCards(catalog.cards, { filter: 'partial' }).map((c) => c.id), ['c']);
  assert.deepEqual(core.filterCards(catalog.cards, { filter: 'unverified' }).map((c) => c.id), ['d']);
  assert.deepEqual(core.filterCards(catalog.cards, { filter: 'unsupported' }).map((c) => c.id), ['b']);
  assert.deepEqual(core.filterCards(catalog.cards, { filter: 'unknown' }).map((c) => c.id), ['e']);
  assert.deepEqual(core.filterCards(catalog.cards, { filter: 'playable', query: 'beta' }), []);
  assert.deepEqual(core.filterCards(catalog.cards, { filter: 'playable', query: 'alpha' }).map((c) => c.id), ['a']);
  assert.deepEqual(core.filterCards(catalog.cards, { query: 'runtime-verified' }).map((c) => c.id), ['d']);
});

test('explorerBounds centres the catalog on large desktops and clears the icon column', () => {
  const large = core.explorerBounds({ width: 1920, height: 1000 });
  assert.deepEqual(large, { x: 410, y: 140, width: 1100, height: 720 });
  const guarded = core.explorerBounds({ width: 1280, height: 800 });
  assert.equal(guarded.width, 1100);
  assert.ok(guarded.x >= 120, 'the icon column stays clear');
  const small = core.explorerBounds({ width: 1024, height: 700 });
  assert.equal(small.width, 976);
  assert.equal(small.height, 652);
  assert.equal(small.x, 24);
  assert.equal(small.y, 24);
  const narrow = core.explorerBounds({ width: 700, height: 560 });
  assert.equal(narrow.width, 652);
  assert.equal(narrow.x, 24);
});

test('cardAssetUrl honours an optional per-card base directory', () => {
  const page = 'https://example.test/flashcards/index.html';
  assert.equal(core.cardAssetUrl({ base: 'cdn/' }, 'a.jpg', page), 'https://example.test/flashcards/cdn/a.jpg');
  assert.equal(core.cardAssetUrl({}, 'assets/a.jpg', page), 'https://example.test/flashcards/assets/a.jpg');
  assert.equal(core.cardAssetUrl({ base: 'javascript:alert(1)' }, 'a.jpg', page), 'https://example.test/flashcards/a.jpg');
  assert.equal(core.cardAssetUrl({ base: 'cards/' }, 'a.jpg', page, { allowData: true }), 'https://example.test/flashcards/cards/a.jpg');
});

test('sanitizeCatalog drops invalid entries and applies defaults', () => {
  const catalog = core.sanitizeCatalog({
    cards: [
      null,
      { title: 'No id' },
      { id: 'ok', title: '  Ok card  ', swf: 'cards/ok.swf', base: 'cards/ok/', width: '0', height: -20, year: 1999, controls: ['Space'] },
      { id: 'ok', title: 'Duplicate' },
    ],
  });
  assert.equal(catalog.cards.length, 1);
  const card = catalog.cards[0];
  assert.equal(card.id, 'ok');
  assert.equal(card.title, 'Ok card');
  assert.equal(card.width, 640);
  assert.equal(card.height, 480);
  assert.equal(card.year, '1999');
  assert.equal(card.base, 'cards/ok/');
  assert.equal(card.fileMissing, false);
  assert.equal(card.keyboardControls.length, 1);
  assert.deepEqual(core.sanitizeCatalog(null), { cards: [] });
  assert.deepEqual(core.sanitizeCatalog({ cards: 'nope' }), { cards: [] });
});

test('artifact cards keep downloads and gallery but never need a SWF', () => {
  const card = core.sanitizeCard({
    id: '1999-rst-screensaver',
    title: 'RAMMSTEIN Screensaver',
    kind: 'artifact',
    preview: 'screensaver.html',
    thumbnail: 'assets/thumbnails/1999-rst-screensaver.jpg',
    width: 800,
    height: 600,
    status: 'Partial — preserved',
    instructions: 'Open the preview.',
    controls: ['Mouse (move to exit)'],
    downloads: [
      { label: 'Original archive', url: 'originals/a.zip', meta: '1 MB' },
      { label: '', url: 'originals/missing-label.zip' },
      { label: 'No URL' },
      'nope',
      null,
    ],
    gallery: [
      { url: 'assets/cards/a/sprites/one.png', caption: 'One' },
      { caption: 'no url' },
    ],
  });
  assert.equal(card.kind, 'artifact');
  assert.equal(card.fileMissing, false);
  assert.equal(card.preview, 'screensaver.html');
  assert.deepEqual(card.downloads.map((entry) => entry.label), ['Original archive']);
  assert.equal(card.downloads[0].meta, '1 MB');
  assert.deepEqual(card.gallery, [{ url: 'assets/cards/a/sprites/one.png', caption: 'One' }]);
  assert.equal(core.matchesSearch(card, 'original archive'), true);
  assert.equal(core.matchesSearch(card, 'screensaver'), true);
  // An unknown kind falls back to the Flash behaviour.
  assert.equal(core.sanitizeCard({ id: 'x', kind: 'something' }).kind, 'flash');
  assert.equal(core.sanitizeCard({ id: 'x' }).fileMissing, true);
});

test('embed cards keep their game URL and never need a SWF', () => {
  const card = core.sanitizeCard({
    id: '1997-asche-zu-asche',
    title: 'Asche zu Asche',
    kind: 'embed',
    url: 'https://asche.example.test/?embed=1',
    thumbnail: 'assets/thumbnails/1997-asche-zu-asche.jpg',
    width: 640,
    height: 480,
    year: 1997,
    status: 'Playable — browser emulator',
    instructions: 'Choose Load game.',
    controls: ['Arrow keys', 'Space'],
  });
  assert.equal(card.kind, 'embed');
  assert.equal(card.url, 'https://asche.example.test/?embed=1');
  assert.equal(card.swf, '');
  assert.equal(card.fileMissing, false);
  assert.equal(core.matchesSearch(card, 'asche'), true);
  assert.equal(core.matchesSearch(card, 'browser game'), true);
  assert.equal(core.matchesSearch(card, 'emulator'), true);
  // Embed entries without a URL keep an empty string instead of crashing.
  assert.equal(core.sanitizeCard({ id: 'x', kind: 'embed' }).url, '');
  // A non-string embed alias is ignored safely.
  assert.equal(core.sanitizeCard({ id: 'x', kind: 'embed', embed: { url: 'https://x' } }).url, '');
});

test('resolveEmbedUrl allows only http(s) game pages', () => {
  const page = 'https://flashcards.example.test/index.html';
  assert.equal(
    core.resolveEmbedUrl('https://game.example.test/?embed=1', page),
    'https://game.example.test/?embed=1',
  );
  assert.equal(core.resolveEmbedUrl('game/page.html', page), 'https://flashcards.example.test/game/page.html');
  assert.equal(core.resolveEmbedUrl('javascript:alert(1)', page), '');
  assert.equal(core.resolveEmbedUrl('file:///tmp/game.html', page), '');
  assert.equal(core.resolveEmbedUrl('data:text/html,<p>hi</p>', page), '');
  assert.equal(core.resolveEmbedUrl('', page), '');
});

test('download and gallery entry lists are bounded and reject malformed items', () => {  const downloads = core.sanitizeDownloadList([
    { label: 'a', url: 'a' },
    { label: 'b', url: 'b', note: 'from note' },
    { label: 'c' },
    null,
    [],
  ]);
  assert.deepEqual(downloads, [
    { label: 'a', url: 'a', meta: '' },
    { label: 'b', url: 'b', meta: 'from note' },
  ]);
  assert.deepEqual(core.sanitizeDownloadList('nope'), []);
  assert.deepEqual(core.sanitizeGallery([{ src: 'a.png', title: 'A' }, { url: 'b.png' }]), [
    { url: 'a.png', caption: 'A' },
    { url: 'b.png', caption: '' },
  ]);
  assert.deepEqual(core.sanitizeGallery(null), []);
  const many = Array.from({ length: 100 }, (unused, i) => ({ label: 'd' + i, url: 'u' + i }));
  assert.equal(core.sanitizeDownloadList(many).length, 40);
  assert.equal(core.sanitizeGallery(many).length, 80);
});

test('expandControls understands strings, arrow groups, letters and objects', () => {
  const entries = core.expandControls(['Arrow keys', 'Space', 'a', '5', { key: 'KeyD', label: 'Duck' }, 'Mouse', 'Weird input']);
  const codes = entries.map((entry) => entry.code);
  assert.deepEqual(codes, [
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Space', 'KeyA', 'Digit5', 'KeyD', null, null,
  ]);
  const duck = entries.find((entry) => entry.code === 'KeyD');
  assert.equal(duck.label, 'Duck');
  const mouse = entries.find((entry) => entry.mouse);
  assert.equal(mouse.label, 'Mouse');
  const weird = entries.find((entry) => entry.unknown);
  assert.equal(weird.label, 'Weird input');
  assert.deepEqual(core.keyboardControls(entries).map((entry) => entry.code), [
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'Digit5', 'KeyD',
  ]);
});

test('expandControls deduplicates repeated keys', () => {
  const entries = core.expandControls(['left', 'ArrowLeft', { key: 'ArrowLeft', label: 'Again' }]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].label, '\u2190 Left');
});

test('keyEventInit builds KeyboardEvent init objects', () => {
  assert.deepEqual(core.keyEventInit('ArrowLeft'), {
    key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, which: 37, bubbles: true, cancelable: true,
  });
  assert.equal(core.keyEventInit('Space').key, ' ');
  assert.equal(core.keyEventInit(null), null);
  assert.equal(core.keyEventInit('NotAKey'), null);
});

test('resolveUrl only allows safe protocols', () => {
  assert.equal(core.resolveUrl('cards/a.swf', 'https://example.test/flashcards/player.html'), 'https://example.test/flashcards/cards/a.swf');
  assert.equal(core.resolveUrl('https://cdn.test/a.swf', 'https://example.test/'), 'https://cdn.test/a.swf');
  assert.equal(core.resolveUrl('javascript:alert(1)', 'https://example.test/'), '');
  assert.equal(core.resolveUrl('', 'https://example.test/'), '');
  assert.equal(core.resolveUrl('data:image/svg+xml,<svg/>', 'https://example.test/', { allowData: true }), 'data:image/svg+xml,<svg/>');
  assert.equal(core.resolveUrl('data:image/svg+xml,<svg/>', 'https://example.test/'), '');
});

test('validatePlayerMessage accepts only well-formed player messages', () => {
  const context = { instance: 4, cardId: 'beta' };
  const status = core.validatePlayerMessage({
    channel: 'flashcards-player', type: 'status', state: 'ready', instance: 4, cardId: 'beta',
  }, context);
  assert.ok(status);
  assert.equal(status.state, 'ready');

  const state = core.validatePlayerMessage({
    channel: 'flashcards-player', type: 'state', instance: '4', cardId: 'beta',
    playing: true, muted: false, volume: 2,
  }, context);
  assert.ok(state);
  assert.equal(state.volume, 1);
  assert.equal(state.playing, true);

  const error = core.validatePlayerMessage({
    channel: 'flashcards-player', type: 'error', instance: 4, cardId: 'beta', message: 'nope',
  }, context);
  assert.equal(error.message, 'nope');
  assert.equal(error.state, 'error');

  assert.equal(core.validatePlayerMessage(null, context), null);
  assert.equal(core.validatePlayerMessage('nope', context), null);
  assert.equal(core.validatePlayerMessage({ channel: 'flashcards-host', type: 'status', state: 'ready' }, context), null);
  assert.equal(core.validatePlayerMessage({ channel: 'flashcards-player', type: 'status', state: 'dancing', cardId: 'beta' }, context), null);
  assert.equal(core.validatePlayerMessage({ channel: 'flashcards-player', type: 'status', state: 'ready', cardId: 'gamma' }, context), null);
  assert.equal(core.validatePlayerMessage({ channel: 'flashcards-player', type: 'status', state: 'ready', instance: 5, cardId: 'beta' }, context), null);
  assert.equal(core.validatePlayerMessage({ channel: 'flashcards-player', type: 'explode', cardId: 'beta' }, context), null);
  assert.equal(core.validatePlayerMessage({ channel: 'flashcards-player', type: 'hello', cardId: 'beta', instance: 4 }, context).type, 'hello');
});

test('validatePlayerMessage requires the card id when the host knows it', () => {
  const context = { instance: 1, cardId: 'alpha' };
  assert.equal(core.validatePlayerMessage({ channel: 'flashcards-player', type: 'status', state: 'loading', instance: 1, cardId: 'alpha' }, context).state, 'loading');
  assert.equal(core.validatePlayerMessage({ channel: 'flashcards-player', type: 'status', state: 'loading', instance: 1 }, context), null);
});
test('Explicit Partial status wins over a missing companion in its explanation', () => {
  assert.equal(core.normalizeStatus('Partial — e-card works; external trailer is missing').key, 'partial');
});
