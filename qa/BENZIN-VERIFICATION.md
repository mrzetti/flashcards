# BENZIN-VERIFICATION — real-runtime input (keyboard + touch)

Scope: the **Benzin Game** card (`2005-benzin-game`) only. This documents the
real-runtime investigation of the reported "timer runs but the truck never
moves" failure, the isolated root cause, the wrapper fixes (metadata focus,
then touch forwarding), and the verified input paths with actual score
evidence. Parent runs the final deployed verification after deploy.

## Environment

- Live URL: `https://flashcards.rammwiki.mrzetti.com/player.html?card=2005-benzin-game`
- Player runtime: self-hosted Ruffle **0.6.0** (`assets/ruffle/`)
- Driver: headless Chromium via Playwright **1.58.2** from `qa/node_modules`,
  launched by these scripts with their own browser profile (no CDP attach; the
  parent's session is untouched).
- Original asset (untouched): `originals/2005-benzin-game.swf`
  (`d22a3d9f…1694249`), also byte-identical to the working Benzin project's
  `assets/original.swf`.

### Headless interaction notes (verification tooling)

Ruffle 0.6 in headless Chromium shows two shadow-DOM layers that cover the
stage and swallow input before the movie sees it:

- `#hardware-acceleration-modal` — full-stage backdrop, `pointer-events: auto`
  (the visible warning content is small, but the backdrop intercepts clicks).
- `#unmute-overlay` — full-stage audio-unlock layer when it is shown.

All verification scripts close/hide both through the shadow DOM before
interacting. On a normal desktop with hardware acceleration the warning may
not appear; the launcher should still ensure the audio overlay is dismissed.

## Reproduction of the reported failure (live site)

Flow with the modal/overlay dismissed: splash `JOUER` (961,755) → main menu
`INSTRUCTIONS` (215,550) → instructions `JOUER` (850,755) → gameplay.

- Timer advances (`00:09:85`), truck does not move, `Score :` stays blank.
- Trusted Playwright ArrowUp + ArrowLeft reach the player document
  (`document.hasFocus() === true`, active element `RUFFLE-PLAYER`, shadow
  active `#container`); the game ignores them.
- Screenshots: `/tmp/opencode/benzin-live-verify/keyboard-01-baseline.png`,
  `keyboard-02-after-arrows.png`.

The same SWF **does drive** under Ruffle 0.6 in a plain top-level harness with
the wrapper out of the picture (`/tmp/opencode/benzin-local4/*` — score 75,
world scrolled), so the content is not at fault. The working Benzin project
(same Ruffle 0.6, community SWF) also drives with the same real keys:
`node benzin-runtime.cjs benzin` → `/tmp/opencode/benzin-working/04-driven.png`
(score 625, truck turned). Its `web/app.js` focuses the player only **after a
touch press** (`send()` → `player.focus()`), never synchronously in
`loadedmetadata`.

## Root cause (isolated)

`player.js` calls `focusRuffle()` **synchronously inside the Ruffle
`loadedmetadata` event** (`onMetadata()` → `state.element.focus()`). With
Ruffle 0.6 that leaves keyboard input dead for the rest of the session. Clicks
and the wrapper's synthetic-key touch path still work.

`qa/benzin-config-bisect.cjs` runs the original SWF with the exact `player.js`
load options and varies only the metadata behaviour (movement measured by the
in-game score appearing):

| variant | metadata call | drives? |
| --- | --- | --- |
| `B-harness` (no focus) | — | **yes** |
| `A-player-opts` (player's load options, no metadata JS) | — | **yes** |
| `A-volume-only` | `ruffle().volume = 0.8` | **yes** |
| `A-volume-deferred` | volume in `setTimeout(0)` | **yes** |
| `A-focus-only` | `element.focus()` in `loadedmetadata` | no |
| `A-container-focus` | `#container.focus()` in `loadedmetadata` | no |
| `A-plus-metadata-js` | volume + `element.focus()` | no |
| `A-focus-deferred-0` | `setTimeout(() => element.focus(), 0)` | **yes** |
| `A-focus-deferred-50` | focus after 50 ms | **yes** |
| `A-focus-deferred` | focus after 1500 ms | **yes** |
| `A-focus-on-click` | focus on first pointerdown | **yes** |
| `A-focus-then-blur` | focus in metadata, `blur()` 1.2 s later | **yes** |
| `A-focus-before-load` | focus before `load()` | **yes** |

So: volume calls are harmless; **focus during the metadata callback (host or
shadow container) is the single trigger**; escaping that callback fixes it.

## Fix (wrapper-side, owned by the launcher worker)

Patch file: [`patches/player.js-defer-metadata-focus.patch`](../patches/player.js-defer-metadata-focus.patch)

```diff
       postState();
-      focusRuffle();
+      window.setTimeout(focusRuffle, 0);
```

`qa/benzin-fix-verify.cjs` serves the repo with the unmodified and the patched
`player.js` and runs the live flow with real Arrow keys:

| session | ArrowUp + ArrowLeft held | result |
| --- | --- | --- |
| control (unmodified `player.js`) | 5 s | truck does not move, score blank |
| fixed (`setTimeout(focusRuffle, 0)`) | 5 s | truck drives, **score 498+** |

Screenshots: `/tmp/opencode/benzin-fix/{control,fixed}-0[1-4]-*.png`.
No SWF patch is needed; the original stays byte-for-byte unchanged.

## Touch-control path (works today on the live player)

The live server still serves the pre-update catalog (mouse-only controls), so
the touch bar does not exist there yet. `qa/benzin-live-verify.cjs` loads the
**live** `player.html` with the pending `catalog.json` served through request
interception (simulating the upcoming redeploy), then drives with the on-screen
controls:

- `Accelerate` held: the truck drives, the world scrolls, **`Score : 75`
  appears** — `/tmp/opencode/benzin-live-verify/touch-02-gas.png`.
- Continued gas + `Turn left`: movement continues
  (`touch-03-gas-left.png`, `touch-04-gas-more.png`).
- Keyboard run in the same script (current deployed wrapper) still shows no
  movement: `keyboard-02-after-arrows.png`.

This means: after the catalog redeploy, touch devices and desktop users who
enable **Touch controls** can play; desktop keyboard needs the one-line
`player.js` fix above.

## Touch forwarding fix (post metadata-fix regression)

After the metadata fix landed and deployed, the on-screen controls still failed
in the parent's rerun: holding **Accelerate** highlighted the button but the
truck stayed still and `Score :` stayed blank (`touch-02-gas.png`). The
diagnosis (`qa/benzin-touch-diagnose.cjs`, final local wrapper) shows the touch
code dispatched the synthetic key **before** moving focus into the player.

Ruffle 0.6 attaches its `keydown`/`keyup` listeners to `window` (bubble phase)
and **ignores synthetic key events while the player element does not have
focus**. Diagnostic matrix (movement/score observed on screen):

| dispatch | focus state | drives? |
| --- | --- | --- |
| real Arrow key | player focused | **yes** |
| synthetic at host | `activeElement` = touch button | no |
| synthetic at host | player focused first | **yes** |
| synthetic at `#container` (composed) | button focused | no |
| synthetic at document / window | button focused | no |
| synthetic at host, `focus()` + dispatch in the same task | player focused | **yes** |
| synthetic at host, `focus()` then rAF then dispatch | player focused | **yes** |

The old `sendKey()` + `focusRuffle()` order therefore depended on a focus race;
that is why the pre-fix public wrapper could drop single-touch input while a
two-finger sequence sometimes woke it up.

### Fix (`player.js`, touch-related code only)

- `sendKey(code, down)` calls `focusRuffle()` **before** dispatching a press, so
  the player owns focus when Ruffle's listener runs.
- The pointerdown handler dispatches through `sendKey` (no trailing focus).
- Keyboard activation of a touch button (`Space`/`Enter`) now holds until the
  matching **window** keyup instead of releasing when focus moves into the
  player; the button `blur` guard no longer cancels a keyboard hold.
- `tests/browser/mobile.test.mjs` updated to the hold-until-keyup semantics.

### Verification — `qa/benzin-touch-verify.cjs`

Real browser input with in-script screenshot analysis (score pixels + world
movement), against the stable local final wrapper
(`http://127.0.0.1:19325/player.html?card=2005-benzin-game`):

| scenario | result |
| --- | --- |
| `mouse-hold` — real mouse holds **Accelerate** | **PASS**; truck drives, **Score: 75** on screen (score-area delta 211 px) |
| `touch-two-finger` — CDP touch, finger 1 holds **Accelerate**, finger 2 adds **Turn left** (`hasTouch` context) | **PASS**; gas-only phase already moves the truck (5.5 % of sampled field pixels), two fingers turn it and **Score: 200** (delta 324 px) |
| `keyboard-button` — focus **Accelerate**, hold Space | **PASS**; truck drives and scores **625** (delta 429 px), `buttonsStillHeld = 0` after release |

Screenshots (all with visible `Score :` and a moved/turned truck):
`/tmp/opencode/benzin-touch-verify/mouse-hold-03-late.png`,
`touch-two-finger-03-gas-turn.png`, `touch-two-finger-04-gas-turn-late.png`,
`keyboard-button-02-held.png`, plus `results.json` in the same directory with
the pointer logs (two simultaneous `pointerType: 'touch'` pointers on
`BUTTON[ArrowUp]` and `BUTTON[ArrowLeft]`).

The same script against the still-undeployed public wrapper
(`PLAYER_URL=https://flashcards.rammwiki.mrzetti.com/player.html?card=2005-benzin-game`,
`OUTDIR=/tmp/opencode/benzin-touch-verify-public`) detects the old behaviour
(mouse-hold and keyboard-button fail; touch works only via the focus race).
Deploy the fixed `player.js`, then rerun
`FLASHCARDS_URL=https://flashcards.rammwiki.mrzetti.com/ node qa/benzin-live-verify.cjs`.

## Reproduce

```sh
cd /root/repos/rammwiki/flashcards/qa
node benzin-config-bisect.cjs        # metadata-focus isolation matrix (/tmp/opencode/benzin-bisect)
node benzin-fix-verify.cjs           # control vs fixed player.js (/tmp/opencode/benzin-fix)
node benzin-touch-diagnose.cjs       # key target/focus matrix (/tmp/opencode/benzin-touch-diag)
node benzin-touch-verify.cjs         # mouse / two-finger touch / keyboard-button (/tmp/opencode/benzin-touch-verify)
FLASHCARDS_URL=http://127.0.0.1:19325/ node benzin-live-verify.cjs   # keyboard + touch delegation
FLASHCARDS_URL=https://flashcards.rammwiki.mrzetti.com/ node benzin-live-verify.cjs  # deployed rerun
```

## Limitations / not claimed

- The deployed **keyboard** path is fixed and was verified by the parent
  (Score 625). The **touch** fix is in this workstream's `player.js` change and
  needs the parent's redeploy; the public run above documents the pre-deploy
  state.
- Historical backends (`acces/*.php`, `listpays.xml`, `benzin1.flv`, the
  `hits.php` counter) were not expected to work and were not exercised; the
  missing `benzin1.flv` leaves the intro video area black but does not affect
  driving or scoring. Score submission was deliberately not tested (out of
  scope, no leaderboard).
- Only the Benzin card was tested here; other cards are covered by the parent's
  runs.
# Integration verification

The coordinator applied deferred metadata focus to `player.js` and verified the
actual final wrapper locally with the original movie. Real arrow input moved and
steered the truck and produced **Score: 625**. The automated wrapper suite now
has 50 passing tests, including a regression for metadata-time focus on load and
restart. The historical investigation below describes the pre-fix deployment.
