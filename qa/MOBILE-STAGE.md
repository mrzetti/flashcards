# Mobile stage clipping QA — 390×844 wrapper

Scope: the final local wrapper at `http://127.0.0.1:19325` with the updated
catalog. Cards checked: **Keine Lust** (`2005-keine-lust`), **Reise, Reise**
(`2004-reise-reise`), **Rosenrot** (`2005-rosenrot`) and **Mann gegen Mann**
(`2005-mann-gegen-mann`).

Method: Playwright Chromium 1228; mobile context 390×844, DPR 2, touch; the
real desktop launcher (explicit Launch) and the standalone `player.html` Start
gate. `player.js` was never edited on disk: the QA scripts intercept the served
`player.js`, append a load-options recorder and, for the fix test, inject
`scale: 'showAll' + forceScale: true` into the in-memory response only
(`qa/mobile-stage*.mjs`).

Revision tested: the wrapper served `player.js` md5
`d68b960ddb09758c4533de72cd33bef9` (identical to `flashcards/player.js` at the
time of writing); its load options contain `letterbox: 'on'` and **no**
`scale`/`forceScale` override.

## Result

| Card | `Stage.scaleMode` in SWF | 390×844 stage area | Clipped at 390? |
|---|---|---|---|
| Keine Lust | **`noScale`** (plus `FSCommand:allowscale false`) | 388×492 CSS | **YES — all four edges** |
| Reise, Reise | not set (default `showAll`) | 388×492 CSS | No (scaled to fit; tiny labels) |
| Rosenrot | not set | 388×492 CSS | No (scaled to fit) |
| Mann gegen Mann | not set | 388×492 CSS | No (scaled to fit; tiny labels) |

Only **Keine Lust** sets `Stage.scaleMode = "noScale"` —
`assets/cards/2005-keine-lust/scripts/frame_1/DoAction.as`:
`Stage.scaleMode = "noScale"; _highquality = 0; getUrl("FSCommand:allowscale", "false"); …`
No `scaleMode` assignment exists anywhere in the Reise, Rosenrot or Mann
exports (`grep -rin "noscale|scaleMode" assets/cards/...`), so Ruffle already
scales those three with its default `scale: 'showAll'`.

### Keine Lust (actual settings, clipping confirmed)

- Mobile stage pixels (776×984 at DPR 2 = 388×492 CSS): non-black content
  bounding box is **0,0 → 775,983**, i.e. content touches every viewport edge.
  The "RAMMSTEIN" wordmark is cut to "AMMS+EIN" and the bottom nav (INFO / WIN /
  VIDEO / TOUR / SCREENSAVER / BUY) is cut at the sides. The 520×520 movie is
  rendered 1:1 in a 388×492 area → **132 px lost horizontally + 28 px
  vertically** at 390×844.
- Desktop actual (818×382 stage): content bbox **159,0 → 658,381** — touches
  top and bottom, so the same 1:1 rendering is clipped vertically there too.

### Verified fix (in-memory only, no on-disk edit)

Adding **`forceScale: true`** to the existing `ruffle().load({...})` options
(the default `scale` is already `'showAll'`; keep `letterbox: 'on'`) makes
Ruffle override the SWF's `noScale`:

- Patched mobile content bbox: **15,119 → 760,879** of 776×984 — inset on every
  edge, full letterboxed menu visible: complete "RAMMSTEIN" wordmark, full
  scene, full bottom bar with INTRO/INFO/WIN/VIDEO/TOUR/SCREENSAVER/BUY and the
  Island/www.rammstein.com player strip. No edge contact, no clipping.
- Captured options confirm the patch reached Ruffle:
  `scale: "showAll", forceScale: true` alongside the unchanged
  `letterbox: "on"`, `autoplay: "on"`, `base: …/originals/`.
- Same patch on Reise (which never needed it) changed nothing, as expected.

Suggested exact change for `player.js` (owned by the Benzin worker):
`forceScale: true,` in the `state.ruffle.load({...})` call. `scale` can be left
at its default `'showAll'`; `letterbox: 'on'` stays.

## Language-gate clicks at 390

- Reise: after a click sweep over the gate region the orange menu appeared
  (`mobile-stage-2004-reise-reise-390-after-language-sweep.png`; the gate may
  also auto-advance, so this is not a click-causality claim). The full-width
  orange artwork fills the 388×492 stage because the 600×400 movie is scaled to
  fit width; nothing is clipped.
- Mann gegen Mann: the same sweep (54 clicks over the tiny "select your
  language / deutsch / english" area) did **not** advance the gate
  (`…-after-language-sweep.png`). The labels are ~5–6 CSS px tall at 390 and
  hard to hit; this is a readability/tap-target limitation of the movie's
  500×630 stage, not clipping.
- The standalone Start gate works at 390 (`mobile-stage-standalone-gate-390.png`).

Ruffle's own hardware-acceleration warning appeared intermittently in headless
and intercepted some clicks (known parent debugging item; no app change made).

## Evidence files

- `mobile-stage.mjs` — per-card 390/desktop screenshots + load-options capture;
  `mobile-stage-results.json`
- `mobile-stage-clicks.mjs`, `mobile-stage-progress.mjs`,
  `mobile-stage-forcecheck.mjs` — gate clicks and forceScale interception
- `mobile-stage-keinelust.mjs` — pixel-bbox proof and forceScale comparison
- Screenshots: `mobile-stage-<id>-390*.png`, `…-desktop*.png`,
  `mobile-stage-keine-lust-390-stage.png`,
  `mobile-stage-keine-lust-390-forcescale-stage.png`,
  `mobile-stage-standalone-gate-390.png`

## Not recommended

- No `forceScale` needed for Reise/Rosenrot/Mann (they do not use `noScale`;
  verified: no effect on Reise).
- Their small labels are a native stage-size readability issue, not clipping;
  no Ruffle scale setting fixes legibility without a UI-level zoom.
