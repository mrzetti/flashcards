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
| Lichtspielhaus | Console INFO / WIN / TRAILER / ORDER controls respond. The embedded trailer plays; ORDER produces the historical shop URL prompt. Audio, mute, volume, restart and fullscreen checked. | Additional `flash/*.swf` modules mentioned by the code are absent; the exercised trailer does not need them. Historical competition/order services are not recreated. |
| Reise, Reise | Small `deutsch` language label opens the e-card; START, SOUND SNIPPETS and INFO change the displayed content and generate audio. Restart and fullscreen checked. | Original language labels are small; fullscreen helps. Historical subscription/send-to-friend services are not recreated. |
| Keine Lust | All seven menu buttons respond with corrected coordinates; INFO, VIDEO and SCREENSAVER render their panels and BUY produces its URL prompt. | The initial blocked verdict was a QA coordinate error. Reconstructed track-label data initializes the music player, but external audio/video and historical services are absent. See `qa/KEINE-LUST-REPAIR.md`. |
| Mann gegen Mann | Language gate, INFO / VIDEO and trailer-link interactions respond; intro audio works. Volume, restart and fullscreen checked. | Trailer requests `SteelExternalAll.swf` and `rammstein_22sec_clean.flv`, both absent. The newsletter overlay renders; its service is not recreated. |
| Rosenrot | Language selection, ship/album presentation and send-to-friend view respond. Audio and actual mute suppression, volume, restart and fullscreen checked. | Original language labels are small. Email delivery and the remotely linked Benzin movie are not restored through the old URLs. |
| Rosenrot Single | Animated imagery/audio progress to the newsletter panel; the form renders. Restart and fullscreen checked. | The newsletter/video-link delivery service is not recreated; this is an archived promotional card, not a functioning subscription service. |
| Pussy | Animated single announcement reaches its final screen; MORE produces Ruffle's URL prompt for the historical Rammstein blog. Audio output, mute, volume, restart and fullscreen checked. | The destination website/video is external and is not preserved by this project. |
| Völkerball | Gallery/menu hotspots reveal concert locations, LIVE DVD, world-tour and edition views. Website/shop prompts, audio, mute, volume, restart and fullscreen checked. | Password-preview, send and wallpaper-download services depend on missing historical files/endpoints. |
| LIFAD | Animated artwork/intro reaches the album screen; ZUR WEBSITE produces the Rammstein URL prompt. Volume control, restart and fullscreen checked. A separate compatibility copy restores the wordmark masks and readable lettering. | No audio signal was observed in the exercised screens. The external website is not archived here. See `qa/LIFAD-RENDERING.md` for the rendering fix. |
| RAMMSTEIN Screensaver (artifact) | The files window, download list and gallery render; the sprite preview loads `scene.json` and runs three sprite sequences (flames, green sparks, red crosses) over the original frame. Automated checks assert the preview reports ready and that launching the card never creates a Ruffle player. | The original Director 6 projector is **not run in the browser** and was not executed at all (16/32-bit Windows only). The preview is a rebuild from the extracted sprites, not a Director emulator; film-loop frame ordering was not recovered. See `PROVENANCE.md` section 13. |

Additional card results and Benzin's dedicated gameplay check are recorded in
`qa/WORKER-VERIFICATION.md` and `qa/BENZIN-VERIFICATION.md`.

## Window/player lifecycle

Keine Lust's original `noScale` stage clipped its menu on smaller windows.
A card-specific Ruffle `forceScale` override now fits the complete stage without
changing the movie. See `qa/MOBILE-STAGE.md` for before/after captures at 390×844.
Reise, Reise, Rosenrot and Mann gegen Mann fit, but their original language-gate
labels remain small on phones; physical-phone usability has not been verified.

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

The **55-test unit/mock-browser suite** additionally exercises loading failures, unsupported
runtime states, message validation, delayed loads while minimized, held-key
release, restart, focus, the standalone Start gate, filtering, artifact cards and
window state. Mocked tests validate wrapper behavior; they do not prove game
compatibility.

## Screensaver artifact

The 1999 screensaver card (a non-Flash artifact) was verified separately:

- In the real catalog run in Chromium, the tile and details render, **Open files
  & preview** opens exactly one `artifact` window, and the preview iframe loads
  `screensaver.html`, fetches the extracted `scene.json`, reports
  `window.__screensaverPreview.ready` and animates three sprite sequences over
  the original frame with zero page errors.
- `tests/browser/artifact.test.mjs` asserts the same flow with a fixture card and
  that launching an artifact never creates a player window or a Ruffle iframe.
- `python3 qa/validate_catalog.py` validates the artifact entry (8 downloads,
  30 gallery images) and all 186 preserved original/extracted hashes, including
  the carved executable, both movies, every sprite, the bundles and the
  installer resources.
- Screenshots of the Explorer, the files window, the gallery and the standalone
  preview page were opened and visually reviewed on 14 September 2026.

Not verified: execution of the original Windows executable or the 16-bit
installer (16/32-bit Windows only), the film-loop frame ordering, and
colour-faithful reproduction of the 1999 display pipeline. The browser preview
is a rebuild from extracted sprites, not a Director runtime; `PROVENANCE.md`
section 13 lists the exact derived artifacts and hashes.

## Reproduce

### Final public deployment check

The completed build was deployed and checked over HTTPS on 14 September 2026.
`qa/check_deployment.py` passed byte-for-byte and MIME checks for the launcher,
player, catalog, SWFs, thumbnails, reconstructed companion and Ruffle runtime.
The real desktop/mobile-emulated lifecycle run passed after the final fixes.
Benzin's public-site verification passed real keyboard driving, mouse-held
acceleration, two-finger acceleration/steering, and keyboard activation of touch
buttons, including release checks. These are browser-emulated input tests, not
physical-phone tests. Keine Lust's card-specific scaling override and companion
were also checked in the final wrapper; all originals retain their recorded hashes.

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
