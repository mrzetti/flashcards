import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const appCore = require('../../app.js');
const playerCore = require('../../player.js');

test('readCardId reads and trims the card parameter', () => {
  assert.equal(playerCore.readCardId('?card=beta'), 'beta');
  assert.equal(playerCore.readCardId('?card=%20beta%20&instance=2'), 'beta');
  assert.equal(playerCore.readCardId('?instance=2'), '');
  assert.equal(playerCore.readCardId(''), '');
});

test('ruffleAvailable reflects the real bootstrap shape', () => {
  assert.equal(playerCore.ruffleAvailable({}), false);
  assert.equal(playerCore.ruffleAvailable({ RufflePlayer: {} }), false);
  assert.equal(playerCore.ruffleAvailable({ RufflePlayer: { newest: () => null } }), false);
  assert.equal(playerCore.ruffleAvailable({ RufflePlayer: { newest: () => ({ createPlayer() {} }) } }), true);
});

test('supportsWebAssembly detects the global', () => {
  assert.equal(playerCore.supportsWebAssembly({ WebAssembly: {} }), true);
  assert.equal(playerCore.supportsWebAssembly({}), false);
});

test('pickCard resolves a catalog entry and normalises it', () => {
  const catalog = {
    cards: [
      { id: 'a', title: 'Alpha', swf: 'cards/a.swf', year: 2001, controls: ['Arrow keys'], status: 'Verified playback', base: 'cards/a/' },
      { id: 'b' },
    ],
  };
  const card = playerCore.pickCard(catalog, 'a');
  assert.equal(card.title, 'Alpha');
  assert.equal(card.year, '2001');
  assert.equal(card.swf, 'cards/a.swf');
  assert.equal(card.status, 'Verified playback');
  assert.equal(card.base, 'cards/a/');
  assert.deepEqual(card.controls.map((entry) => entry.code), ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  assert.equal(playerCore.pickCard(catalog, 'missing'), null);
  assert.equal(playerCore.pickCard(null, 'a'), null);
  assert.equal(playerCore.pickCard({ cards: [] }, 'a'), null);
});

test('cardFileBase prefers a card base, then a ?base= parameter, then the document', () => {
  const documentBase = 'https://example.test/flashcards/player.html';
  assert.equal(playerCore.cardFileBase({ base: 'cards/alpha/' }, '', documentBase), 'https://example.test/flashcards/cards/alpha/');
  assert.equal(playerCore.cardFileBase({}, 'originals/', documentBase), 'https://example.test/flashcards/originals/');
  assert.equal(playerCore.cardFileBase({}, '', documentBase), documentBase);
  assert.equal(playerCore.cardFileBase({ base: 'javascript:alert(1)' }, 'cards/', documentBase), 'https://example.test/flashcards/cards/');
  assert.equal(playerCore.cardFileBase({ base: 'https://cdn.test/cards/' }, '', documentBase), 'https://cdn.test/cards/');
});

test('host message validation accepts commands and clamps volume', () => {
  const context = { instance: '7' };
  assert.deepEqual(playerCore.validateHostMessage({ channel: 'flashcards-host', type: 'pause', instance: '7' }, context), { type: 'pause' });
  assert.deepEqual(playerCore.validateHostMessage({ channel: 'flashcards-host', type: 'focus', instance: 7 }, context), { type: 'focus' });
  assert.deepEqual(playerCore.validateHostMessage({ channel: 'flashcards-host', type: 'volume', value: '0.35', instance: '7' }, context), { type: 'volume', value: 0.35 });
  assert.deepEqual(playerCore.validateHostMessage({ channel: 'flashcards-host', type: 'volume', value: 9, instance: '7' }, context), { type: 'volume', value: 1 });
  assert.deepEqual(playerCore.validateHostMessage({ channel: 'flashcards-host', type: 'volume', value: -3, instance: '7' }, context), { type: 'volume', value: 0 });

  assert.equal(playerCore.validateHostMessage(null, context), null);
  assert.equal(playerCore.validateHostMessage({ channel: 'flashcards-player', type: 'pause', instance: '7' }, context), null);
  assert.equal(playerCore.validateHostMessage({ channel: 'flashcards-host', type: 'detonate', instance: '7' }, context), null);
  assert.equal(playerCore.validateHostMessage({ channel: 'flashcards-host', type: 'volume', value: 'loud', instance: '7' }, context), null);
  assert.equal(playerCore.validateHostMessage({ channel: 'flashcards-host', type: 'pause', instance: '8' }, context), null);
  assert.deepEqual(playerCore.validateHostMessage({ channel: 'flashcards-host', type: 'resume' }, context), { type: 'resume' });
});

test('app and player control parsing stay in sync', () => {
  const vectors = [
    ['Arrow keys', 'Space'],
    [{ key: 'ArrowLeft', label: 'Left' }, 'Mouse'],
    ['a', '5', 'Weird'],
    [],
  ];
  for (const vector of vectors) {
    assert.deepEqual(appCore.expandControls(vector), playerCore.expandControls(vector));
  }
});

test('keyEventInit agrees between app.js and player.js', () => {
  for (const code of ['ArrowLeft', 'ArrowUp', 'Space', 'Enter', 'KeyA', 'Digit3']) {
    assert.deepEqual(appCore.keyEventInit(code), playerCore.keyEventInit(code));
  }
});

test('resolveAssetUrl allows web/file URLs and rejects scripts', () => {
  assert.equal(
    playerCore.resolveAssetUrl('originals/2001-mutter.swf', 'https://example.test/flashcards/player.html'),
    'https://example.test/flashcards/originals/2001-mutter.swf',
  );
  assert.equal(playerCore.resolveAssetUrl('https://cdn.test/a.swf', 'https://example.test/'), 'https://cdn.test/a.swf');
  assert.equal(playerCore.resolveAssetUrl('javascript:alert(1)', 'https://example.test/'), '');
  assert.equal(playerCore.resolveAssetUrl('data:application/x-shockwave-flash;base64,AAAA', 'https://example.test/'), '');
  assert.equal(playerCore.resolveAssetUrl('', 'https://example.test/'), '');
});

test('describeError and sentence produce readable messages', () => {
  assert.equal(playerCore.describeError(new Error('boom')), 'boom');
  assert.equal(playerCore.describeError('plain'), 'plain');
  assert.equal(playerCore.describeError(null), 'Unknown error.');
  assert.equal(playerCore.sentence(new Error('boom')), 'boom.');
  assert.equal(playerCore.sentence(new Error('boom.')), 'boom.');
  assert.equal(playerCore.sentence('already!'), 'already!');
});

test('readStoredVolume falls back safely and honours stored values', () => {
  const fake = (value) => ({ getItem: () => value });
  assert.equal(playerCore.readStoredVolume(null), 0.8);
  assert.equal(playerCore.readStoredVolume({ getItem: () => null }), 0.8);
  assert.equal(playerCore.readStoredVolume(fake('')), 0.8);
  assert.equal(playerCore.readStoredVolume(fake('0')), 0);
  assert.equal(playerCore.readStoredVolume(fake('0.35')), 0.35);
  assert.equal(playerCore.readStoredVolume(fake('1')), 1);
  assert.equal(playerCore.readStoredVolume(fake('2')), 0.8);
  assert.equal(playerCore.readStoredVolume(fake('loud')), 0.8);
  assert.equal(playerCore.readStoredVolume({ getItem() { throw new Error('blocked'); } }), 0.8);
});
