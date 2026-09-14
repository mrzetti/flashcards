# Worker verification — 7-card runtime audit (deployed public site)

Owner: runtime-worker subagent. Status: **complete** (all seven cards run, screenshots
reviewed, results documented below). Date: 2026-09-14.

Publication note: the full raw run directory (including failed coordinate-search
experiments) remains on the original server and is ignored by Git. Selected
final contact sheets and run JSON are committed under `qa/evidence/worker/`.
The scripts in `qa/runtime-worker/` reproduce the complete output directory.

Coordinator clarification: decompiler-exported `movies/7.flv` for LIFAD is
embedded in its original SWF. Its standalone export not being served is **not**
a missing runtime dependency; the card did not request it during the run.
By contrast, Mann gegen Mann's named external trailer and player skin were
actually requested and returned 404.

Target: `https://flashcards.rammwiki.mrzetti.com` — the **initial public deployment**
(the parent's local wrapper at `127.0.0.1:19325` was not used and does not affect
these results). Out of scope: other 6 cards, mobile emulation, launcher lifecycle,
final deploy (parent).

## Verdict summary

| Card | Runtime verdict | Menus actually clicked | Measured audio | Issues |
| --- | --- | --- | --- | --- |
| `2003-lichtspielhaus` | **PASS** | INFO / WIN / TRAILER / ORDER console | trailer 0.16 RMS; mute drop 0.078 → 0.000 → 0.093 | none affecting playback |
| `2004-reise-reise` | **PASS** (tiny labels) | `deutsch` gate; START / SOUND SNIPPETS / INFO | 0.028–0.119 RMS across steps | labels ~10 px; controls-phase sound had stopped |
| `2005-keine-lust` | **BLOCKED (content)** | all 7 bottom items clicked — no effect | none, ever | looping intro; menu dead; `player_txt.txt` LoadVars 404 |
| `2005-mann-gegen-mann` | **PASS** (tiny labels) | `deutsch` gate; INFO / VIDEO / trailer link | 0.045 RMS after gate | trailer skin+FLV 404; exclusive-video/newsletter overlay (not submitted) |
| `2005-rosenrot` | **PASS** (tiny labels) | `deutsch`/`english` gate; SOUND/ALBUM/SEND views | 0.012–0.126 RMS; mute drop 0.034 → 0.000 → 0.088 | none affecting playback |
| `2006-voelkerball` | **PASS** | 11 gallery/menu hotspots; rammstein.de + shop links | up to ~0.21 RMS; mute drop 0.058 → 0.000 → 0.050 | none affecting playback |
| `2009-lifad` | **PASS** | intro click; ZUR WEBSITE link | none (no sound at these screens) | embedded FLV not shipped (documented); no 404 observed |

"PASS" = the card loads, settles, responds to real clicks, and the player chrome
works. "RMS" = real Web Audio root-mean-square measured by `qa/audio-probe.js`
(post-gain, so Mute reads ≈0) — **not** evidence that a human heard it.
No physical phone was used.

## Method

- Playwright 1.58.2 + bundled Chromium, headless, 1280×900, dsf 1, direct
  `player.html?card=<id>` entries.
- `qa/audio-probe.js` injected with `context.addInitScript` before any page
  script; taps every node connected to `destination`.
- Per card: metadata wait → Ruffle CPU-warning modal consumed → settle
  detection (3 identical stage screenshots) → semantic clicks (with measured
  coordinates, stabilization after changes) → 8×6 grid sweep when semantics
  don't change the view → Mute/Unmute → volume 30 %/80 % → Restart → Fullscreen.
- Every click is judged by a stage-screenshot hash diff; new requests, console
  messages, native dialogs and popups are attributed to the step.
- **Correction found during the audit:** the universal-rock ecards open on a
  "select your language" gate whose labels are only ~10 px tall in a
  520–628 px stage. The first coarse grid missed them and wrongly looked
  "non-interactive". Labels were measured with ffmpeg pixel scans and the
  runs redone; the first-pass runs are archived in
  `out/_v2-missed-spots/` and the matrix experiments in
  `out/_v2-missed-spots/<card>/matrix/`.

### Honesty constraints

- Headless software rendering (`wgpu-webgl` via SwiftShader) → Ruffle shows its
  one-shot "hardware acceleration disabled" warning on first mouseover; the
  runner dismisses it. Not a site bug.
- Historical forms/competitions: only menus/links were clicked. **No fields
  filled, nothing submitted**; every URL-open confirm was dismissed (deny).
- The catalog chrome shown is the deployed older snapshot; the seven SWF
  payloads hash-matched the repo copies at test time (see below).

## Deployment snapshot (tested)

Deployed `player.js` `8812db28…`, `player.html` `409ddd82…`, `app.js`
`9b131966…`, `index.html` `4c337c98…`, `catalog.json` `a0071b2d…`,
`styles.css` `033378c0…` (sha256, stable across the whole run). The local
working tree has since moved ahead (parent's edits); `qa/check_deployment.py`
already fails on `index.html` against the current tree — expected until the
final deploy.

SWF sha256 prefixes (deployed == repo copy at test time):
`2003` `2edc92d3…`, `2004` `f14ec32d…`, `2005-keine-lust` `378d2401…`,
`2005-mann-gegen-mann` `12911b1b…`, `2005-rosenrot` `5af8dab0…`,
`2006` `ee3f3a29…`, `2009-lifad` `7f88d332…`.

Deployed catalog still has filename-derived years/titles/instructions that the
working tree has already corrected (e.g. `Lichtspielhaus (2003)` / `year 2003`
vs. local `Lichtspielhaus` / `year null`; `Mann gegen Mann (2005)` vs. local
`year 2006`). Not a runtime blocker.

## Per-card results

### 2003-lichtspielhaus — PASS

- SWF 500×300, 498 frames @ 25 fps, v6 (AVM1). Settled static after ~14 s.
- Console UI rendered (screenshot `out/2003-lichtspielhaus/05-settled-stage.png`:
  hexagon + INFO / WIN / TRAILER / ORDER rows).
- Clicks (stage fractions measured from the screenshot):
  - TRAILER `(0.73, 0.58)` → `DVD OUT NOW` trailer frame, RMS 0.164
    (`out/2003-lichtspielhaus/sequence/step1-TRAILER-after.png`).
  - WIN `(0.81, 0.39)` → WIN row selected, RMS 0.059.
  - ORDER `(0.77, 0.77)` → ORDER row selected, RMS 0.078 **and** native confirm
    `The SWF file wants to open the website https://www.motordiscs.de/…` (dismissed).
  - Semantic run additionally clicked ORDER `(0.5,0.85)`, `(0.75,0.85)`, top
    `(0.5,0.15)` and trailer row `(0.35,0.70)`, `(0.65,0.70)` — all changed the
    view; five confirm dialogs total (motordiscs.de ×4, motor.de newsletter ×1),
    all dismissed.
- Audio: before mute 0.0776 → muted 0.0000 → unmuted 0.0927 (RWAV `__audioAudit`).
  Mute also verified via `aria-pressed` and state (`muted:true → false`).
- Volume slider 30 % → `state.volume 0.3`, output "30 %"; restored 80 %.
- Restart: SWF re-requested 1×, status Playing, returns to the intro/trailer
  (`44-restarted-stage.png` = `CONCERT HIGHLIGHTS`), initial frame not identical
  (intro replays).
- Fullscreen: entered (`document.fullscreenElement true`), Escape returns.
- Missing `flash/*.swf` modules are 404 on the host (verified by direct HEAD),
  but none of the exercised flows requested them — the trailer that we clicked
  plays from the SWF itself. Evidence: `out/2003-lichtspielhaus/run.json`,
  `out/2003-lichtspielhaus/sequence/ls-seq.json`, `contact-sheet.png`.

### 2004-reise-reise — PASS (tiny labels)

- SWF 600×400, 1107 frames @ 31 fps, v6. Settles on the language gate.
- Language gate (measured): `deutsch` `(0.127, 0.364)` → transition, RMS 0.028
  (see matrix run `out/_v2-missed-spots/2004-reise-reise/matrix/matrix.json`;
  an `english` click after the screen changed hit a shop link and produced
  `universal-rock.de/frameloader.php` confirm dialogs, all dismissed).
- Ecard main screen reached: orange cover → band intro → top menu
  `START | SOUND SNIPPETS | INFO | TOURDATES | SEND TO A FRIEND`.
- Sequence `out/2004-reise-reise/sequence/rr-seq.json`:
  - `deutsch` RMS 0.028 → cover screen;
  - START `(0.05, 0.051)` RMS 0.119 → band intro animation;
  - SOUND SNIPPETS `(0.21, 0.051)` RMS 0.100 → snippet view;
  - INFO `(0.357, 0.051)` RMS 0.009 → album/info view.
  All four changed the stage; screenshots `step*-after.png`.
- Restart returns to the language gate (`returnedToInitialFrame=true`); SWF
  re-requested once.
- Audio evidence `sessionHadSound:true`; by the controls phase the ecard was
  quiet, so the mute RMS drop was not measurable there (state/UI checks passed).
- No failed or external requests during the final run.
- Newsletter form at the bottom was **not** touched.

### 2005-keine-lust — BLOCKED (card content)

- SWF 520×520, only 2 timeline frames @ 25 fps, v6, content in sprites.
- The intro animation loops forever: **45 of 45 screenshots unique over 90 s**
  (`out/2005-keine-lust/long-probe/probe.json` → `watch`), it never settles.
- Bottom menu row measured at y ≈ 0.816 and all seven items clicked after a
  90 s wait: INTRO `(0.211)`, INFO `(0.258)`, WIN `(0.298)`, VIDEO `(0.343)`,
  TOUR `(0.392)`, SCREENSAVER `(0.463)`, BUY `(0.542)`.
  → No section change beyond the looping animation, no dialogs, no requests,
  no audio. Hover produces the same animation-only diff.
- Root-cause candidate: the SWF calls `player_vars.load("player_txt.txt", …)`
  (string present in the SWF); deployed host returns **404 for
  `/player_txt.txt`** and Ruffle logs
  `Error during LoadVars load of "https://flashcards.rammwiki.mrzetti.com/player_txt.txt": HttpNotOk(404)`.
  The file is **not in the repo** (`find` found no `player_txt.txt`; not in
  `PROVENANCE.md`). Menu actions may depend on variables from that file.
- No audio measured at any point; mute/volume/fullscreen chrome still work.
- Evidence: `out/2005-keine-lust/run.json` (`failedRequests` ×2),
  `out/2005-keine-lust/long-probe/` (probe.json, `90-watched.png`,
  `t-<ITEM>-before/after.png`), `contact-sheet.png`.
- **Action for parent:** recover `player_txt.txt` from the original archive
  (if it exists there) and/or decide whether to keep the card with a note.

> **Supplement (2026-09-14, see `KEINE-LUST-REPAIR.md`):** the "blocked" verdict
> above was a QA coordinate error, not a card defect. Ruffle draws this card's
> 520×520 noScale stage 1:1 and centred (origin `(380, 157.5)` at 1280×900);
> with corrected coordinates all seven menu items respond (INFO/VIDEO/
> SCREENSAVER sections, BUY opens the `universalbuybutton.com` confirm). The
> missing companion affects only the music-player sprite and has been
> reconstructed and verified (`patches/keine-lust/player_txt.txt`, required at
> the deploy root — see the repair report).

### 2005-mann-gegen-mann — PASS (tiny labels) + trailer deps missing

- SWF 500×630, 541 frames @ 25 fps, v8. Settles on the language gate.
- Gate: `deutsch` `(0.194, 0.310)` → changed, RMS 0.045 → ecard starts. The
  `english` label was not separately verified: by the time it was clicked the
  gate had already transitioned, so the click landed on the ecard screen.
  A matrix pass over the gate label (archived) recorded click / double-click /
  hold / drag / tap all producing the change plus audio.
- Main screen reached (`out/2005-mann-gegen-mann/21-sem-02-settled.png`):
  single artwork, CD BESTELLEN/Download → Shoplocator, trailer link,
  INFO / VIDEO / SEND ECARD / RAMMSTEIN SHOP, www.rammstein.de.
- Sequence `out/2005-mann-gegen-mann/sequence/mgm-seq.json`:
  - INFO `(0.93, 0.435)` RMS 0.045 → changed;
  - VIDEO `(0.93, 0.466)` → changed;
  - trailer link `(0.51, 0.34)` → changed **and requested missing files**:
    `/SteelExternalAll.swf` **404** and `/originals/rammstein_22sec_clean.flv`
    **404**; the page opens an "Exklusives Video …" newsletter overlay
    (`step4-TRAILER-LINK-after.png`). **Not filled, not submitted.**
- Audio RMS up to ~0.05 after the gate; `sessionHadSound:true`. Controls-phase
  sound had stopped → mute RMS drop not measurable there.
- Restart returns to the language gate (`returnedToInitialFrame=true`).
- Evidence: `run.json`, `sequence/`, `contact-sheet.png`,
  `out/_v2-missed-spots/2005-mann-gegen-mann/matrix/matrix.json`.

### 2005-rosenrot — PASS (tiny labels)

- SWF 628×471, 297 frames @ 31 fps, v6. Settles on the language gate.
- Gate: `deutsch` `(0.139, 0.605)` and `english` `(0.134, 0.659)` both clickable;
  after the click the ecard fades in; `windloop` audio starts (RMS 0.012–0.017).
- Ecard sections reached by the semantic run (`run.json`):
  `(0.5, 0.5)` RMS 0.092; `(0.5, 0.8)` RMS 0.126; `(0.2, 0.8)` RMS 0.025 —
  screenshots show the ship-in-ice scenes, "SEND TO A FRIEND" and "ALBUM" views
  (`out/2005-rosenrot/20-sem-0*-changed.png`, `21-sem-0*-settled.png`,
  `contact-sheet.png`).
- Audio: before mute 0.0342 → muted 0.0000 → unmuted 0.0883; mute toggle state
  + `aria-pressed` also verified. **This is the cleanest audio+mute proof of
  the three ecards.**
- Restart: SWF re-requested; returns to the intro/gate (frame diff vs. initial).
- No failed/external requests. send2Friend/Benzin URLs were not triggered.
- Evidence: `out/2005-rosenrot/run.json`, `contact-sheet.png`,
  `out/_v2-missed-spots/2005-rosenrot/matrix/matrix.json`.

### 2006-voelkerball — PASS

- SWF 850×650, 899 frames @ 25 fps, v8. Settled static after ~36 s.
- 8×6 grid sweep found **11 clickable hotspots** (gallery/menu rows at
  y ≈ 0.252 / 0.414): views include `LIVE DVD` + Nimes/Moskau/London/Tokio,
  `RAMMSTEIN WELTTOUR`, `ERHÄLTLICH IN 3 VERSCHIEDENEN EDITIONEN`, logo/smoke
  transitions (`out/2006-voelkerball/contact-sheet.png`, `30-grid-*.png`).
- Native confirms recorded (dismissed): `https://www.rammstein.de/` and
  `https://www.rammsteinshop.de/`.
- Audio: up to ~0.21 RMS on gallery clicks; before mute 0.0581 → muted 0.0000 →
  unmuted 0.0505.
- Restart re-requests the SWF and replays the intro; fullscreen works.
- Historical preview password/send endpoints were not exercised; catalog already
  documents that they fail without the original servers.
- Evidence: `out/2006-voelkerball/run.json`, `contact-sheet.png`.

### 2009-lifad — PASS (no audio)

- SWF 800×585, 202 frames @ 30 fps, v8. Intro animates slowly (9 unique
  frames/28 s) and does not fully settle.
- Artwork screen with `LIEBE IST FÜR ALLE DA` + `ZUR WEBSITE` reached
  (`05-settled-stage.png`).
- `ZUR WEBSITE` `(0.50, 0.947)` click → stage changed **and** native confirm
  `The SWF file wants to open the website https://www.rammstein.de/`
  (dismissed; recorded in `run.json` → `semanticClicks[1].dialogs`).
  Other clicks hit the artwork/video area (animation-only diffs).
- No measurable Web Audio RMS at any point (card is silent at these screens in
  our run). Embedded `movies/7.flv` was not copied to the repo; no FLV request
  occurred during our interactions, so the intro's video is either embedded or
  not reached.
- Restart re-requests the SWF and replays the intro; fullscreen works.
- Evidence: `out/2009-lifad/run.json`, `contact-sheet.png`.

## Cross-cutting findings

1. **Language-gate precision.** The three universal-rock ecards
   (Reise, Reise / Mann gegen Mann / Rosenrot) are interactive, but their gate
   labels are tiny (~10 px tall). Coarse automated clicks look like "nothing
   happens"; a user with a mouse can still hit them, but the catalog text could
   mention "click the small `deutsch` / `english` labels". Coordinates are in
   `PLANS` in `verify-cards.cjs`.
2. **Missing runtime data.** `player_txt.txt` (Keine Lust LoadVars) 404s and the
   card's menus stay dead; `SteelExternalAll.swf` + `rammstein_22sec_clean.flv`
   (Mann gegen Mann trailer) 404; `flash/*.swf` (Lichtspielhaus modules) and
   `movies/7.flv` (LIFAD) are absent from the repo/host (direct HEAD checks).
   None of these files exist in the repo, so the parent may need to recover
   them from the original archives or annotate the cards.
3. **Player chrome is consistent across all seven cards:** metadata → Playing,
   Mute/Unmute state + `aria-pressed` + label, volume slider, Restart
   (re-requests the SWF, no error panel), Fullscreen enter/exit, and the
   no-card/unknown-id error panels + Retry (`out/_error-cases/run.json`).
4. **Ruffle CPU warning** is a headless-environment artifact (SwiftShader
   adapter reported as CPU) and is dismissed before interactions.
5. First-pass false negatives (coarse grid) are preserved and labelled in
   `out/_v2-missed-spots/`; the final per-card runs are authoritative.

## Evidence map

- `qa/runtime-worker/out/summary.json` — aggregate of the final runs.
- `qa/runtime-worker/out/<card>/run.json` — per-step state/audio/requests/dialogs.
- `qa/runtime-worker/out/<card>/contact-sheet.png` — reviewed screenshot sheet.
- `qa/runtime-worker/out/<card>/sequence/*.json` + PNGs — language→menu sequences
  (2003, 2004, 2005-mann-gegen-mann).
- `qa/runtime-worker/out/2005-keine-lust/long-probe/` — 90 s loop probe + menu
  clicks + LoadVars 404.
- `qa/runtime-worker/out/_error-cases/` — error/Retry screens.
- `qa/runtime-worker/out/run-final.log` — console summary of the final run.
- `qa/runtime-worker/out/_v2-missed-spots/` — archived first-pass runs and
  label-technique matrices (hover/click/dblclick/hold/drag/tap/rapid).

## Reproduce

```bash
cd qa/runtime-worker
./reproduce.sh                 # seven cards, final script (≈15 min)
python3 analyze-runs.py        # summary + contact sheets
# targeted single-menu runner:
node targeted-click.cjs --card 2009-lifad --fx 0.50 --fy 0.947 --label zur-website --settle 25000
# language→menu sequences:
node sequence-click.cjs --card 2005-mann-gegen-mann --tag mgm-seq \
  --steps "deutsch:0.194,0.310:6000;INFO:0.93,0.435:3000;VIDEO:0.93,0.466:3000;TRAILER-LINK:0.51,0.34:4000"
```

## Supplement — Keine Lust companion repair (2026-09-14)

Appended after the original seven-card audit; the original sections above are
preserved unchanged except for a marked correction note in the Keine Lust
section.

- Root cause of the earlier "BLOCKED (card content)" verdict: our harness
  computed click points from a fit-scaled stage rect (1.495×). With
  `Stage.scaleMode="noScale"` + `fscommand("fullscreen","true")`, Ruffle draws
  the 520×520 stage **1:1, canvas-centred** (origin `(380, 157.5)` at
  1280×900). The real buttons are at SWF y 471.5–495.5; we were clicking
  ~20–50 px above them. Verified with `mapping-probe/mapping-markers.png`.
- With corrected coordinates, all seven menu buttons respond (real clicks +
  screenshots): INFO → signup/info section, VIDEO → "choose your full video
  stream" screen, SCREENSAVER → screensaver section, BUY → native confirm for
  `universalbuybutton.com` (dismissed), INTRO/WIN/TOUR also change the view.
- `player_txt.txt` reconstructed from the FFDec export
  (`patches/keine-lust/player_txt.txt`, 41 bytes): `numTracks=1` &
  `trackTitle1=01: KEINE LUST`; `trackTitle1` is genuine embedded data,
  `numTracks` is a documented inference. Staged test: with the file at the
  deploy root the SWF's `LoadVars` gets 200 and the music-player sprite
  advances (it then requests `/audio/track1.mp3`, 404 — no audio assets in the
  archive). Placing the file only next to the SWF fails (Ruffle requests it at
  the site root). Full details: `qa/KEINE-LUST-REPAIR.md`.
- Audio: the SWF has no embedded sounds (`DefineSound` absent); all sound was
  external and none of it exists in the supplied ZIP, so no genuine audio could
  be played back. The track request is the measurable companion-shape proof.
