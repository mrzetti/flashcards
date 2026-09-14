# Keine Lust companion patch — `player_txt.txt`

Scope: reconstructed runtime companion for `originals/2005-keine-lust.swf`.
The original SWF is **not modified** (sha256
`378d2401372a6bbf15a00c9c88455c75cfdc42bfc51482b3b88f6f08c5373c64`).

## Files

| File | Bytes | sha256 |
| --- | ---: | --- |
| `player_txt.txt` | 44 | `dc90ff8f…` (see `SHA256SUMS` next to it) |
| copy in `assets/cards/2005-keine-lust/player_txt.txt` | 44 | identical |

Content (URL-encoded LoadVars pairs, no comments — Flash `LoadVars` would parse
comments as data):

```
numTracks=1&trackTitle1=01%3A%20KEINE%20LUST
```

## Why this file

FFDec export of the SWF (`DefineSprite_359/frame_1/DoAction.as`):

```as
player_vars = new LoadVars();
player_vars.load("player_txt.txt");
player_vars.onLoad = function(success)
{
   if(success)
   {
      gotoAndStop("init");     // music-player sprite only advances on success
   }
};
stop();
```

`DefineSprite_359/frame_2/DoAction.as` then reads:

```as
trackTotal = player_vars.numTracks;
...
track = "trackTitle" + i;
trackName.push(player_vars[track]);
...
title = trackName[0];
trackName = ["01: KEINE LUST"];   // then overwritten with the embedded title
s.loadSound("audio/track" + trackNum + ".mp3", true);
```

So the variables expected from the companion are **`numTracks`** (integer) and
**`trackTitleN`** (strings). Without a successful load the sprite stays on its
loading frame forever.

## Provenance and uncertainty

- `trackTitle1` value `01: KEINE LUST` is **genuine embedded data**: it is the
  hard-coded replacement value in the SWF's own frame script (`trackName =
  ["01: KEINE LUST"]`), so it is what the original player displayed.
- `numTracks=1` is a **reconstruction inference**, not recovered bytes. The
  supplied archive (`Flashcards.zip`) contains **no `player_txt.txt`** (checked
  against all 36,482 ZIP entries) and no `audio/trackN.mp3`; only one title is
  embedded anywhere. A different original track count would change only the
  (overwritten) loop, not the visible UI. A Wayback CDX check of the original
  host (`hyperlaunch.com/rammstein/keinelust/`) found no `player_txt.txt` and
  no audio captures either.
- No audio assets are recoverable from the archive: the SWF has no
  `DefineSound` tags (`sounds/` export is empty); all sound was external
  (`audio/trackN.mp3`, `exodus.interoutemediaservices.com` streams, the
  `bleep` rollover). None of them are in the archive.

## Final deployment configuration

The final wrapper supplies a SWF-relative `base`. The deployed companion is an
identical copy at **`originals/player_txt.txt`**. The coordinator verified a 200
response there followed by the expected 404 for `originals/audio/track1.mp3`.
The older staging configuration below predates that wrapper update.

## Earlier staging configuration (verified)

With the earlier deployed wrapper (`player.js` `load({url: swfUrl, …})`, no
`base`), Ruffle resolves `LoadVars`/`loadSound` against the **page URL**, not
the SWF directory:

- Put the companion at the **site root**: `<site>/player_txt.txt` — then the
  SWF can stay at `originals/2005-keine-lust.swf` with no catalog change.
  Verified: `/player_txt.txt` → 200 and the music player advanced (it then
  requested `/audio/track1.mp3`).
- An isolated folder alone does **not** work: with the SWF under
  `assets/cards/2005-keine-lust/` Ruffle still requested `/player_txt.txt` at
  the site root (404). Root placement is required unless the wrapper sets a
  Ruffle `base` for the compatibility folder or adds a URL rewrite
  (`/player_txt.txt` → `/assets/cards/2005-keine-lust/player_txt.txt`).
- `loadSound("audio/track1.mp3")` also resolves to the site root
  (`/audio/track1.mp3`), so any recovered tracks would belong in
  `<site>/audio/`, not `originals/audio/`.

## Verification

`qa/keine-lust-repair-test.cjs` builds local staging trees and runs the
unmodified SWF with this companion:

- variant `root`: SWF `/originals/…`, companion at root →
  `player_txt.txt 200`, `audio/track1.mp3 404` (expected), no LoadVars error,
  menu button BUY opened `universalbuybutton.com` confirm dialog.
- variant `isolated-dir`: companion beside the SWF → root request 404,
  LoadVars error, no track request (root placement requirement proven).

Evidence: `qa/runtime-worker/out/2005-keine-lust/repair-root.json`,
`repair-isolated-dir.json`, `repair-root-*.png`.
