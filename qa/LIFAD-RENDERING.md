# LIFAD final frame — RAMMSTEIN wordmark rendering

Card: `2009-lifad` (`originals/2009-lifad.swf`, sha256
`7f88d332193381f8a370202a24ca15e7f000978e218cb02b9a97b2624fab94bc`).
Runtime: self-hosted Ruffle 0.6.0 (`assets/ruffle/`). Player tested through
`patches/lifad/harness.html` (standalone, autoplay, same load options as
`player.js`); the public page still shows the old behaviour until the catalog
entry is pointed at the patched file (coordinator-owned).

## Symptom

At the end of the intro (root frame 202, `stop()`) the top wordmark renders as
solid gold rectangles. The subtitle `LIEBE IST FÜR ALLE DA`, the artwork, the
divider lines and `ZUR WEBSITE` render normally. Reproduced with the project's
Ruffle 0.6.0 and with the current Ruffle nightly — it is not a wrapper, scaling
or timing issue.

## Root cause

The SWF contains **no font tags at all** (`-dumpSWF`: no `DefineFont*`,
`DefineText`, `DefineEditText`). The wordmark is vector artwork:

* `DefineSprite` character 48 (27 frames) places nine letter-shaped sprites —
  characters 30, 33, 35, 37, 39, 41, 43, 45, 47 (shapes 2, 32, 34, 36, 38, 40,
  42, 44, 46) — each with a `clipDepth`, and ten instances of character 31
  (shape 4, a gold gradient bar) two depths above their mask;
* the masks are invisible and clip the bars into gold letterforms; the bars are
  tweened frame by frame (ratio/transform updates) to animate the shine;
* `RAMMSTEIN` is nine glyphs in the band's stylized lettering, including the
  band's cross-shaped `T` (confirmed against the official wordmark and against
  FFDec's own `DefineSprite_48` export).

Ruffle does not apply the clip depth for a mask inside this sprite, so the ten
gold bars draw in full and look like blocks. This is the open upstream issue
[ruffle-rs/ruffle#23630](https://github.com/ruffle-rs/ruffle/issues/23630)
(same structure: clip-depth mask inside a `DefineSprite`, moving overlay not
constrained). The same limitation shows in FFDec's root-frame export (the
archive's `LIFAD/frames/*.png` blocks); FFDec's per-sprite export renders the
letterforms correctly, which proves the intended construction.

## Fix (faithful, SWF-side compatibility patch)

`patches/lifad/build-compat.py` regenerates
`assets/cards/2009-lifad/2009-lifad-ruffle-compat.swf`
(sha256 `22d2f6a80b447ecf9e7a2d013c03ca7fbaac28e776f0eb5fabca5c6961a3c766`) from
the untouched original by:

1. dropping `clipDepth` from the ten mask placements and giving masks/contents
   instance names (`m055`/`c057`, …);
2. inserting six AVM1 `DoAction` tags at sprite frames 2, 8, 10, 12, 14, 16:

```as2
c057.setMask(m055); m055._visible = false;   // one pair per line
```

All geometry, gradients, transforms, tweens, the embedded video, the button and
the root timeline (202 frames, 30 fps, 800×585) are unchanged. The only other
binary difference is a one-bit re-encoding of shapes 15/16 by FFDec's XML
round-trip; their exported SVG path data is byte-identical. Full diff:
`qa/lifad-evidence/tag-diff.txt`, mask table: `qa/lifad-evidence/mask-pairs.txt`.

`build-compat.py` reproduces the patched file byte-for-byte with FFDec 26.2.1.

## Verification

Tested 2026-09-14 through `patches/lifad/harness.html` (800×585 Ruffle
element): Ruffle 0.6.0 (project bundle, matches upstream `ruffle-0.6.0-web-selfhosted.zip`)
and the current nightly available with uploaded assets at test time,
`nightly-2026-09-12` (the 09-14 nightly had only its AVM2 report uploaded).

| build | Ruffle | wordmark | `enclosedDark` (glyph counters) |
| --- | --- | --- | --- |
| original | 0.6.0 (project bundle) | solid blocks | 0 |
| patched | 0.6.0 (project bundle) | `RAMMSTEIN` | ≈950 (run-dependent) |
| original | nightly-2026-09-12 | solid blocks | — |
| patched | nightly-2026-09-12 | `RAMMSTEIN` | — |

`enclosedDark` counts background pixels in the logo band with gold above and
below within 22 px — zero for solid bars, non-zero only when real glyph
counters/notches exist. The test (`qa/lifad-render-test.cjs`) asserts exactly
that: original = 0, patched ≥ 100; it prints `LIFAD render test PASSED`.

Screenshots and data in `qa/lifad-evidence/`:

* `lifad-original.png` / `lifad-patched.png` — final frames (800×585)
* `lifad-original-mid.png` / `lifad-patched-mid.png` — second capture from an
  independent run, same final state (guards against a lucky frame)
* `r060-live-top-2x.png`, `r060-nofilter-top.png` — bug detail; the 0,0 blur
  filter on the parent sprite is not the cause (removing it changed nothing)
* `setmask-final-top-2x.png`, `nightly-setmask-top.png` — fixed detail
* `ffdec-sprite48-wordmark.png` — independent FFDec reference letterforms
* `before-after-logo.png` — original vs patched band
* `frames-190-200.png` — FFDec frame exports showing the same block artefact
* `render-results.json`, `tag-diff.txt`, `mask-pairs.txt`, `hashes.txt`

## Ruffle version recommendation

The bug is unfixed in the current release line and in nightly (tested
isolated: nightly-2026-09-12 self-hosted, wgpu-webgl). **Do not change the
pinned Ruffle 0.6.0 runtime for this card** — update instead to the patched SWF,
which also fixes nightlies as a side effect. If upstream #23630 is fixed in a
future release, the patched file can be retired, but it is harmless under a
fixed renderer because `setMask()` is the same masking semantics Flash Player
used.

## Reproduce

```bash
cd /root/repos/rammwiki/flashcards
python3 -m http.server 19325 --bind 127.0.0.1 --directory . &

# rebuild the patched SWF (byte-identical to the shipped copy)
python3 patches/lifad/build-compat.py \
  originals/2009-lifad.swf \
  assets/cards/2009-lifad/2009-lifad-ruffle-compat.swf

# browser render test (Playwright from qa/node_modules)
node qa/lifad-render-test.cjs
```

## Provenance / limits

* Source archive: `/home/mrzetti/downloads/Flashcards.zip` — SWF entry
  `Flashcards/2009 - LIFAD.swf` is byte-identical to
  `originals/2009-lifad.swf` (verified sha256), so the archive adds no unseen
  variant.
* The fix uses the SWF's own mask shapes and gradient bars; no approximation,
  redraw or HTML overlay.
* `assets/cards/2009-lifad/2009-lifad-ruffle-compat.swf` and
  `patches/lifad/2009-lifad-ruffle-compat.swf` are identical copies
  (`SHA256SUMS` in `patches/lifad/`).
