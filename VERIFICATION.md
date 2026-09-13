# Browser verification

Verification was performed on 13–14 September 2026 using automated Chromium
browsers on the server. The coordinator used Playwright 1.58.2 / Chromium 145
for real-runtime checks, in addition to the launcher's mocked-browser suite.
Screenshots were opened and visually reviewed. **Mobile checks use browser
emulation (390 × 844), not a physical phone.**

## What the checks establish

The real-runtime checks load the original/extracted movies through the vendored
Ruffle 0.6.0, dismiss its hardware-acceleration notice when it appears in
headless Chromium, and explicitly activate audio. An injected Web Audio analyser
measures signal output; this establishes that audio is being generated and that
mute suppresses it. It is **not a claim of listening through speakers**, nor a
complete assessment of audio fidelity.

Each movie was inspected beyond loading: navigation, pointer reactions, text
entry, or animation progression, as appropriate to that card. The scope is
representative interaction, not every possible branch or historical backend.
Historical mailing lists and competition entries were not submitted.

## Card results

| Card | Verified interaction | Remaining limitations |
| --- | --- | --- |
| Mutter — archive 2001 | Animated green intro reaches its entry screen; audio output, mute, volume and restart work. SKIP/entry controls were exercised. | These controls target the original `index.html`, which is absent from the archive. The original website beyond the intro is not restored. |
| Ich will | After the intro, moving the pointer produces the scanning/line visualizer; holding still changes its presentation. Audio output, mute, volume, restart and fullscreen checked. | The intro includes a black interval before the interface appears; allow time for it. External RealMedia video, order and e-card services are not restored. |
| Mutter — archive 2002 | Intro, menu and TOUR navigation work; historical tour-date text renders. Audio output, mute, volume, restart and fullscreen checked. | German original UI retained. RealMedia/RTSP media and e-card delivery services are not restored. |
| Rosenrot Single | Animated imagery/audio progress to the newsletter panel; the form renders. Restart and fullscreen checked. | The newsletter/video-link delivery service is not recreated; this is an archived promotional card, not a functioning subscription service. |
| Pussy | Animated single announcement reaches its final screen; MORE produces Ruffle's URL prompt for the historical Rammstein blog. Audio output, mute, volume, restart and fullscreen checked. | The destination website/video is external and is not preserved by this project. |

Additional card results and Benzin's dedicated gameplay check are recorded in
`qa/WORKER-VERIFICATION.md` and `qa/BENZIN-VERIFICATION.md`.

## Window/player lifecycle

The coordinator's `qa/launcher.cjs` checks the real Ruffle player in both desktop
and mobile-emulated layouts:

- `?card=id` selects a card without creating a player.
- Explicit launch creates exactly one iframe/Ruffle execution context.
- Minimize pauses; taskbar restore resumes the player.
- Maximize/restore and desktop dragging stay within desktop bounds.
- Fullscreen enters and exits through the real player toolbar in both tested
  layouts, including the mobile-emulated Chromium context.
- Close removes the iframe and detaches its execution context.
- Reopen creates a fresh context; switching cards detaches the previous one.
- The narrow layout has no horizontal page overflow; Benzin receives four
  card-specific touch keys.

The **49-test unit/mock-browser suite** additionally exercises loading failures, unsupported
runtime states, message validation, delayed loads while minimized, held-key
release, restart, focus, the standalone Start gate, filtering, and window state.
Mocked tests validate wrapper behavior; they do not prove game compatibility.

## Reproduce

Launcher tests (development dependencies only; no runtime build needed):

```sh
npm ci
npx playwright install --with-deps chromium
npm test
python3 qa/validate_catalog.py
```

Real-runtime maintenance tools:

```sh
cd qa
npm ci
npx playwright install --with-deps chromium
node capture.cjs 2001-mutter 2001-ich-will 2002-mutter 2005-rosenrot-single 2009-pussy
node launcher.cjs
```

Set `FLASHCARDS_URL` to a local HTTP or deployed HTTPS root ending in `/` to test
another host. Capture helpers write to `/tmp/opencode/flashcards-*` (create that
directory on another VPS). They are maintenance tools, and timeline timing may
need adjustment on slower machines. `qa/audio-probe.js` is QA-only and is not
deployed. Selected evidence is in `qa/evidence/`; some captures show earlier
catalog wording because the labels were corrected after the first playback pass.

Deployment integrity: `python3 qa/check_deployment.py https://YOUR_HOST/` checks
HTTP status, MIME types and byte-for-byte equivalence for the catalog, SWFs,
thumbnails and runtime binaries.
