# patches/lifad/ — Ruffle compatibility patch for `2009-lifad.swf`

Scope: the LIFAD (`2009-lifad`) card renders the RAMMSTEIN wordmark as solid
gold rectangles in Ruffle. The original SWF stays byte-for-byte untouched; this
directory holds the reproducible compatibility build and its test harness.

## Problem

`originals/2009-lifad.swf` builds the wordmark inside `DefineSprite` (chid 48)
from ten clip-depth masks: nine letter-shaped sprites (characters 30, 33, 35,
37, 39, 41, 43, 45, 47) each clip an instance of the animated gold-gradient bar
(character 31) placed two depths above it:

```
frame 2 : mask dpt 55 cdp 59 -> content dpt 57     frame 10: mask dpt 13 cdp 17 -> content dpt 15
frame 8 : mask dpt 43 cdp 47 -> content dpt 45     frame 10: mask dpt 37 cdp 41 -> content dpt 39
frame 8 : mask dpt 49 cdp 53 -> content dpt 51     frame 12: mask dpt  7 cdp 11 -> content dpt  9
frame 12: mask dpt 31 cdp 35 -> content dpt 33     frame 14: mask dpt  1 cdp  5 -> content dpt  3
frame 14: mask dpt 25 cdp 29 -> content dpt 27     frame 16: mask dpt 19 cdp 23 -> content dpt 21
```

Ruffle ignores the clip depth in this nested-sprite case, so the ten gradient
bars draw as solid rectangles. This is the open upstream bug
[ruffle-rs/ruffle#23630](https://github.com/ruffle-rs/ruffle/issues/23630)
("Clip-depth mask inside a sprite doesn't constrain a moving overlay"). It is
present in Ruffle 0.6.0 (the bundle used by this site) **and** in
nightly-2026-09-12.

FFDec 26.2.1 confirms the intended construction: exporting `DefineSprite_48`
alone renders the gold `RAMMSTEIN` letterforms (its root-frame renderer has the
same clip-depth limitation, hence the blocks in its frame exports).

## Fix

Replace each clip-depth pair with the equivalent ActionScript runtime path, the
workaround verified in the upstream issue — no HTML overlay, no redrawn logo:

```as2
c057.setMask(m055);
m055._visible = false;
```

* the ten mask placements lose `clipDepth` and gain instance names (`m055`…);
* the ten gradient-bar placements gain instance names (`c057`…);
* six `DoAction` tags (frames 2, 8, 10, 12, 14, 16 of the sprite) are inserted
  that call `setMask` as soon as both instances exist;
* everything else — geometry, gradients, colour transforms, tweens, the video,
  the `ZUR WEBSITE` button, `stop()` at frame 202 — is unchanged.

`build-compat.py` regenerates the patch deterministically from the original:

```bash
python3 patches/lifad/build-compat.py \
  originals/2009-lifad.swf \
  assets/cards/2009-lifad/2009-lifad-ruffle-compat.swf
```

FFDec 26.2.1 (`/root/repos/rammwiki/benzin/tools/ffdec/ffdec.jar`, override with
`FFDEC_JAR`) is required. The build is byte-reproducible with that version; the
XML round-trip re-encodes two one-line shapes (characters 15/16) by one trailing
bit while their exported SVG path data stays identical — see
`../../qa/lifad-evidence/tag-diff.txt` for the complete tag-level diff.

## Files

| File | Bytes | sha256 |
| --- | ---: | --- |
| `2009-lifad-ruffle-compat.swf` (copy under `assets/cards/2009-lifad/`) | 631519 | `22d2f6a8…` |
| `build-compat.py` | — | `4ff306ec…` (see `SHA256SUMS`) |
| `harness.html` | — | `1ded3e74…` |

`SHA256SUMS` has the full values, including the untouched original
(`7f88d332…`).

## Integration

The wrapper/catalog are owned by the coordinator. To deploy, point the
`2009-lifad` catalog entry at
`assets/cards/2009-lifad/2009-lifad-ruffle-compat.swf` (keep `originals/` as the
preserved master). No other wrapper change is needed; the patched file has no
external companions.

## Verification

`qa/lifad-render-test.cjs` loads both files through `harness.html` with the
project's self-hosted Ruffle and asserts the logo band contains glyph counters
only for the patched build:

| build | Ruffle 0.6.0 | nightly-2026-09-12 | enclosed background pixels |
| --- | --- | --- | --- |
| `originals/2009-lifad.swf` | blocks | blocks | 0 |
| `2009-lifad-ruffle-compat.swf` | `RAMMSTEIN` | `RAMMSTEIN` | ≈950 (run-dependent) |

Evidence: `qa/lifad-evidence/` and `qa/LIFAD-RENDERING.md`.
