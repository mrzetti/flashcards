# Keine Lust repair — companion `player_txt.txt` (supplement to the 7-card QA)

**Final-wrapper integration correction:** the wrapper now supplies Ruffle's
SWF-relative `base`. The coordinator observed a request to
`/originals/player_txt.txt` on the final build, so the reconstructed file is
deployed there. The root-placement findings below apply to the older wrapper
used in the worker's staging run.

Date: 2026-09-14. Owner: runtime-worker. Status: **companion reconstructed and
verified; card menus proven interactive (the earlier "BLOCKED" verdict was a QA
coordinate error, not a card defect); no recoverable audio assets.**

Scope: `assets/cards/2005-keine-lust/`, `patches/keine-lust/`,
`qa/KEINE-LUST-REPAIR.md`, `qa/keine-lust*.cjs`. Original SWF unchanged.

## 1. Investigation

- **Source archive check**: `/home/mrzetti/downloads/Flashcards.zip` (1.68 GB,
  36,482 entries, the archive recorded in `PROVENANCE.md`) contains **no
  `player_txt.txt`** and no `audio/*.mp3`; it only holds the SWF and its FFDec
  export (`Flashcards/Keine Lust/{texts,scripts,sprites,…}`).
- **Fresh full FFDec export** (v26.2.1, `/root/repos/rammwiki/benzin/tools/ffdec/ffdec.jar
  -export all`) into `/tmp/opencode/fc-qa/kl-ffdec/` (1,610 files) plus a full
  `-swf2xml` dump.
- **Bounded web-archive research** (Wayback CDX, 4 queries): the original host
  path `hyperlaunch.com/rammstein/keinelust/` is archived only as `index`,
  `images/button.gif`, `NEW.swf` (different size, 306,741 B), `pp.html` and
  `register.php`. No `player_txt.txt` and no `audio/*` captures exist, so the
  original companion bytes and tracks are not recoverable from the archive
  either.
- The companion is consumed by the **music-player sprite**
  (`scripts/DefineSprite_359/frame_1/DoAction.as`):
  `player_vars.load("player_txt.txt")` → `if(success) gotoAndStop("init")`;
  frame 2 reads `player_vars.numTracks` and `player_vars["trackTitle"+i]`, then
  hard-codes `trackName = ["01: KEINE LUST"]` and
  `s.loadSound("audio/track" + n + ".mp3", true)`.
- The **menu buttons do not use the companion**. They set
  `/:navnavdestination` and `tellTarget("_root.images") gotoAndStop(n)`
  (button handlers `DefineButton2_{208,211,214,217,219,221,223}`); the section
  sprites poll that variable on frames 1–2. Menus fail only when clicks miss.

## 2. Companion reconstruction

`patches/keine-lust/player_txt.txt` (44 bytes, sha256 `dc90ff8f…`):

```
numTracks=1&trackTitle1=01%3A%20KEINE%20LUST
```

- `trackTitle1 = "01: KEINE LUST"` is **genuine embedded data** (the SWF's own
  hard-coded fallback title).
- `numTracks=1` is an **inference** (documented in `patches/keine-lust/README.md`);
  the true original value is not recoverable from this archive because the
  companion file is absent. Its only use is a loop that is immediately
  overwritten by the hard-coded title array.
- An identical copy is staged at
  `assets/cards/2005-keine-lust/player_txt.txt` for an isolated-folder layout.

## 3. Verified behaviour (staged, unmodified SWF)

`qa/keine-lust-repair-test.cjs` serves two local staging trees with the deployed
wrapper files and runs the original SWF:

| Variant | player_txt | music-player proof | LoadVars error | BUY button |
| --- | --- | --- | --- | --- |
| `root` (companion at site root, SWF in `originals/`) | **200** | requested `/audio/track1.mp3` (404, missing asset) → `onLoad(success)` path ran | none | confirm dialog `universalbuybutton.com` |
| `isolated-dir` (companion next to SWF only) | **404** at site root | no track request | `HttpNotOk(404)` | confirm dialog (menus independent of companion) |

Evidence: `qa/runtime-worker/out/2005-keine-lust/repair-root.json`,
`repair-isolated-dir.json`, `repair-root-*.png`,
`repair-isolated-dir-*.png`.

## 4. Menu interaction correction (important)

The earlier seven-card run recorded "no clickable hotspots" for this card. That
was a **coordinate-mapping error in our QA harness**: with
`Stage.scaleMode = "noScale"` and `fscommand("fullscreen","true")`, Ruffle draws
the 520×520 stage **1:1 and centred in the canvas** (origin `(380, 157.5)` at
1280×900), not fit-scaled to the content box as our `getSurface()` assumed.
The visible menu row is ~20 px above where we were clicking.

With corrected coordinates (button rectangles from the SWF XML: INTRO
`(16,471)` 44×24 … BUY `(308,471)` 42×24), all seven menu items respond:

- `INFO` → info/signup section (`SIGN UP TO OFFICIAL RAMMSTEIN MAILING LIST…`).
- `VIDEO` → `KEINE LUST TO SOUND CLIP - CHOOSE FLASH MP3/WMA…` + "click here to
  choose the full video stream".
- `SCREENSAVER` → red screensaver section.
- `BUY` → native confirm `http://www.universalbuybutton.com/site.php?k=M7780S7810V7820`
  (dismissed; nothing opened or submitted).
- INTRO/WIN/TOUR also changed the view.

Screenshots: `repair-root-<ITEM>-before/after.png`,
`mapping-probe/mapping-markers.png` (marker B lands on the real menu row;
marker A shows the old wrong fit-mapping).

Audio: the SWF embeds **no** sound (`DefineSound` tags absent, `sounds/` export
empty). All sound was external (`audio/trackN.mp3`, `exodus…` streams, `bleep`
rollover); none of those files exist in the archive, so no genuine audio could
be played or recovered. The 404 for `/audio/track1.mp3` is the measurable proof
that the player advanced with the companion.

## 5. Exact required configuration for the parent

1. Ship `patches/keine-lust/player_txt.txt` as **`<deploy-root>/player_txt.txt`**
   (next to `index.html`/`player.html`). No catalog change is needed; the card
   keeps `swf: originals/2005-keine-lust.swf`.
2. If root placement is not acceptable, the wrapper must make the file resolve
   for the card — set a Ruffle `base` for a compatibility folder, or add a
   rewrite `/player_txt.txt` → `/assets/cards/2005-keine-lust/player_txt.txt`.
   Staging proved that putting the file only next to the SWF is **not enough**.
3. Optional/track audio: `loadSound("audio/track1.mp3")` resolves to
   `<deploy-root>/audio/track1.mp3`; no such files exist, so the music-player
   track will stay silent unless they are recovered elsewhere.

## 6. What is not recoverable / open items

- The original `player_txt.txt` bytes (track count and any further titles) were
  not in the supplied ZIP and have no other local copy.
- No `trackN.mp3` audio files, no `bleep` asset; the embedded streams point at
  dead historical services. Web/archive research was not needed for the repair
  (the dependency is fully determined by the SWF); no fabricated history added.

## 7. Reproduce

```bash
cd /root/repos/rammwiki/flashcards/qa
node keine-lust-repair-test.cjs        # both staging variants + menu clicks
node keine-lust-mapping.cjs            # stage mapping markers on the live site
```
