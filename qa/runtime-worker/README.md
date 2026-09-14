# runtime-worker (Flashcards QA)

Owner: runtime QA worker. Scope: runtime interaction verification of the seven
cards `2003-lichtspielhaus` … `2009-lifad` on the deployed site
`https://flashcards.rammwiki.mrzetti.com` using Playwright + Chromium.

## Files

| File | Purpose |
| --- | --- |
| `verify-cards.cjs` | main runner: per-card load, CPU-warning modal handling, settle detection, semantic + 8×6 grid clicks, WebAudio RMS sampling, Mute/volume/Restart/Fullscreen, network/console/dialog capture |
| `targeted-click.cjs` | click a single known menu point and record the before/hover/after triplet, dialogs, popups, requests |
| `sequence-click.cjs` | click an ordered list of stage points (e.g. language gate → main-screen menu) with per-step change/dialog/request/audio capture |
| `label-matrix.cjs` | per point: hover / click / double-click / hold / drag / touch-tap / rapid clicks, with change + RMS + dialog capture |
| `keine-lust-probe.cjs` | 90 s intro-loop and menu-click probe for `2005-keine-lust` |
| `analyze-runs.py` | summarize `out/<card>/run.json` + build `contact-sheet.png` with ffmpeg |
| `make-sheet.py` | labeled contact sheet builder (ffmpeg only) |
| `reproduce.sh` | reruns the whole verification |
| `out/<card>/run.json` | per-card evidence record (state, audio, requests, clicks) |
| `out/<card>/*.png` | screenshots (stage crops + full page) |
| `out/summary.json` | aggregate summary |
| `out/_error-cases/` | no-card / unknown-card error panel evidence |
| `out/_v2-missed-spots/` | archived first-pass runs + language-gate technique matrices |
| `out/_v1-initial-run/` | archived earliest probing scripts and outputs |

## Notes

- Audio is measured with `../audio-probe.js` injected via
  `context.addInitScript`, which taps the real Web Audio graph (post-gain, so
  Mute should read ≈0). RMS values prove signal, not that anyone "heard" it;
  the runs are headless and not a physical-device test.
- The deployed site was the "initial deployment" during this run; deployed
  `player.js`/`app.js`/`styles.css`/`catalog.json` were older than the repo
  working tree at the time (the parent owner handles the final deploy). The
  seven SWF payloads hash-matched the local repo copies.
- Headless Chromium renders with SwiftShader; Ruffle therefore shows its
  one-shot "hardware acceleration disabled" warning on the first mouseover.
  The runner consumes that modal once per page before clicking.
- Exploratory one-off scripts kept for traceability: `probe.cjs`,
  `clicktest*.cjs`, `cursor-probe.cjs`, `rosenrot-deep.cjs`. The per-card
  evidence comes from `verify-cards.cjs` (+ `sequence-click.cjs` /
  `targeted-click.cjs` / `label-matrix.cjs` / `keine-lust-probe.cjs`).
