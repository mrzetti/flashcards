# Flashcards tests

Everything in this folder verifies the static Flashcards desktop without touching
the real `catalog.json`, the real SWF files or the self-hosted Ruffle build.

## Running

```bash
cd flashcards
npm install        # installs Playwright 1.63 (the Chromium binary is cached)
npm test           # unit + browser tests
npm run test:unit  # pure helper tests only (fast, no browser)
npm run test:browser
npm run serve      # manual preview on http://127.0.0.1:4173
```

`npm run serve` uses the real `catalog.json` and `assets/ruffle/ruffle.js` when
they exist and falls back to the test fixtures so the desktop always opens.
The browser tests themselves always use the fixtures through `tests/server.mjs`.

`BROWSER_PATH` can point at another Chromium executable if the pinned one is
missing.

## What is covered

Unit tests (`tests/unit/`):

- window bound clamping (normal, minimum size, compact/phone mode)
- Explorer centring/bounds for large desktops (icon column stays clear)
- 12-hour clock formatting
- catalog status categories: `Verified playback`/`Playable` -> Playable,
  `Partial — ...` -> Partial, `Not runtime-verified` -> Unverified (never
  Playable), `Unsupported` -> Unsupported, unknown raw -> Unknown; full raw
  text is preserved for the details pane
- search matching and per-category filters
- catalog sanitising (defaults, duplicate ids, invalid entries, optional
  per-card `base` directory)
- asset URL resolution with and without a `base` override (no `javascript:`)
- controls parsing: arrow groups, single keys, letters, digits, mouse-only and
  unknown entries; the app and player copies are compared against the same
  vectors
- player/host message validation: channel, type, state, instance token, card id,
  volume clamping
- embed URL resolution: http(s) only, relative paths, rejects `file:`, `data:`
  and script URLs; embed catalog entries never need a SWF
- stored volume fallback

Browser tests (`tests/browser/`, Playwright + mock Ruffle):

- Explorer catalog: short status labels with raw text in tooltips and the pane,
  category counts and filters, search, disabled launch for a missing SWF,
  broken-thumbnail placeholder
- initial Explorer window is centred (1100x720) on large desktops and the
  desktop icon column remains visible
- deep links (`?card=id`): selection and Launch button, zero iframes, unknown ids
- windows: minimize/restore from the taskbar, maximize/restore, double-click
  title bar, drag bounded to the desktop, resize limits, close
- single-player lifecycle: explicit launch loads the card URL with
  `autoplay: 'on'` and a `base` pointing at the card's own directory; switching
  cards removes the old iframe before the new one starts (one iframe at any
  time, destroy counter increases)
- standalone `player.html?card=id` shows an explicit Start card gate and does
  not create or load a player until it is clicked
- minimize pauses; restore resumes only a card that was playing (an errored card
  is not resumed, a card that became ready while minimized waits paused)
- volume, mute, restart and fullscreen controls incl. state messages
- loading, error and unsupported panels; "Close player" via a validated
  `request-close` message
- forged/stale `postMessage` data from the wrong window or with the wrong
  instance/card id is ignored
- focus lands inside Ruffle; keyboard events reach the mocked player
- mobile: compact full-size windows, no page overflow, touch keyboard contains
  exactly the keys a card lists, held touch keys survive focus changes,
  keyboard activation releases on blur
- embed cards: one browser-game window, click-to-load fixture frame, switching
  cards replaces the previous document, closing releases the frame, deep links
  select without launching, and Ruffle/player frames are never created

## Mock Ruffle

`tests/fixtures/mock-ruffle.js` mirrors the parts of the Ruffle 0.6 public API
that the player uses (`RufflePlayer.newest().createPlayer()`, `ruffle().load`,
`reload`, `resume`, `suspend`, `volume`, fullscreen calls, `loadedmetadata` /
`loadeddata` events). It records every call in `window.__ruffleMock.calls` and
counts destroyed players in `localStorage['flashcards.mock.destroyed']`, which
is how iframe teardown is asserted.

The same site was also checked against the real self-hosted Ruffle 0.6.0 build
from `benzin/web/vendor/ruffle` with the actual Benzin SWF: metadata was reported
(600x450, ActionScript 1), mute/restart/minimize/restore/close all worked, and
only the SWF's own retired external hosts produced network errors. That manual
run lived outside the repository under `/tmp/opencode`.

## Files

- `server.mjs` – static server with fixture overrides (preview mode included)
- `fixtures/catalog.json` – seven cards covering verified, partial, unverified,
  unsupported, unknown, missing-file and broken cases
- `fixtures/mock-ruffle.js` – API-compatible mock with per-card personalities
- `fixtures/thumbs/card.svg` – thumbnail; one fixture card intentionally points
  at a missing file
- `browser/helpers.mjs` – shared browser/server setup

## Optional catalog base override

Card assets normally resolve relative to `player.html`/`index.html`, which live
next to `catalog.json`. A catalog entry may add an optional `base` string (a
directory URL) and the player accepts `?base=` for the same purpose; both are
validated to `http:`, `https:` or `file:` and the player also passes the SWF's
own directory to Ruffle as `base` so companion requests stay with the card.
