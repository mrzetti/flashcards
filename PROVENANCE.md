# PROVENANCE — RammWiki Flashcards

This document records where the preserved Flash cards came from, what was
extracted or derived, what was deliberately left out, and what has and has not
been verified. Section 13 covers the separately supplied 1999 RAMMSTEIN
screensaver, section 16 the separately supplied 2001 Mutter Enhanced CD and
section 17 the separately supplied 2002 xXx soundtrack e-card; everything
before section 13 covers the Flashcard archive. It distinguishes
the **source of this collection** (the archives below) from **URLs that appear
inside the content** (historical captions, forms and scripts), which are *not*
provenance.

## 1. Source archive

| Property | Value |
| --- | --- |
| File | `/home/mrzetti/downloads/Flashcards.zip` (user-supplied) |
| Size | 1,681,961,479 bytes |
| Modified | 2026-09-13 21:35:56 UTC |
| SHA-256 | `71f6d98212a11bd05c9cc5bf4c7f9155eebe95a166848204ac64f192643a3b29` |
| ZIP entries | 36,482 (34,215 files + 2,267 directory entries) |
| Uncompressed | 1,672,647,855 bytes |

The archive contains 13 top-level Flash movies (8 `.swf`, 5 `.exe`) and 12
decompiled export folders (`texts/`, `scripts/`, `images/`, `frames/`,
`sprites/`, `sounds/`, `fonts/`, `buttons/`, `shapes/`, `morphshapes/`,
`movies/`, `symbols.csv`). The folder names omit the year prefixes used by the
binary filenames.

**Original download URL: not recorded and not verified.** The archive was
received as a local user-supplied file; no source URL, author or download page
is claimed anywhere in this repo. Do not infer a source from the embedded
`http(s)` URLs listed in section 8 — those are strings that were inside the
Flash content itself.

## 2. Preserved originals — `originals/`

All 13 top-level binaries were extracted byte-for-byte. Each file's CRC-32 was
compared against the ZIP central directory during the build (all matched), and
SHA-256 sums are stored in [`originals/SHA256SUMS`](originals/SHA256SUMS).

Original filenames were mapped to stable ASCII slugs (for URLs); the bytes are
unchanged. No original SWF, EXE or projector was patched or recompressed.
A separate LIFAD compatibility copy under `assets/cards/2009-lifad/` replaces
the wordmark's clip-depth masking with equivalent ActionScript `setMask` calls.
It retains the original letter shapes and gradients. See `patches/lifad/README.md`
for the reproducible build, hashes, and exact tag changes; the catalog uses this
copy to work around Ruffle's block-letter rendering defect.

| id | Original ZIP name | Repo file | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| 2001-mutter | `2001 - Mutter.swf` | `originals/2001-mutter.swf` | 146,580 | `c2ff5becbd4f3898698e2590eecd8ad7381765e87858ead82c350ede5a199f8c` |
| 2001-ich-will | `2001 - Ich will.exe` | `originals/2001-ich-will.exe` | 1,176,238 | `e453063301b5376ebf7268cc214a88ce69a11280810138f0557b22c333612083` |
| 2002-mutter | `2002 - Mutter.exe` | `originals/2002-mutter.exe` | 757,248 | `daac0927ea20c01db3160e0df4346a2db02c30fedd97a57a6c6b52a5ee4c1ab5` |
| 2003-lichtspielhaus | `2003 - Lichtspielhaus.exe` | `originals/2003-lichtspielhaus.exe` | 2,022,229 | `e732f132235e719532282f4dbd42de7ef4a682bfde4436008826af27556af9a9` |
| 2004-reise-reise | `2004 - Reise, Reise.exe` | `originals/2004-reise-reise.exe` | 2,983,622 | `3bcdcf967768aa7c00f6027db5da2c5d50ee28b805a4942777093ee2f663ea36` |
| 2005-benzin-game | `2005 - Benzin Game.swf` | `originals/2005-benzin-game.swf` | 1,570,054 | `d22a3d9f6f7abde09a19aa29ab6a8ec12317c388e2ec900ca0e7697fd1694249` |
| 2005-keine-lust | `2005 - Keine Lust.swf` | `originals/2005-keine-lust.swf` | 306,317 | `378d2401372a6bbf15a00c9c88455c75cfdc42bfc51482b3b88f6f08c5373c64` |
| 2005-mann-gegen-mann | `2005 - Mann gegen Mann.swf` | `originals/2005-mann-gegen-mann.swf` | 1,091,520 | `12911b1b895dff99931b20b562a0f24e4fbe250b770bdb425b1892cb00872d6b` |
| 2005-rosenrot | `2005 - Rosenrot.exe` | `originals/2005-rosenrot.exe` | 2,273,940 | `56061203786b3506a7e96af1c060e5dd207dfbbe208f532cad38bb1853a51c38` |
| 2005-rosenrot-single | `2005 - Rosenrot (Single).swf` | `originals/2005-rosenrot-single.swf` | 253,270 | `2072f96285b70be21031c2bd53a8966b370c696787d98f77f60f5a98249a6bb4` |
| 2006-voelkerball | `2006 - Völkerball.swf` | `originals/2006-voelkerball.swf` | 2,854,279 | `ee3f3a29fc1ee8e12089d66b633bcc8603e45896ded9f0f83debf94d5a1b3bea` |
| 2009-lifad | `2009 - LIFAD.swf` | `originals/2009-lifad.swf` | 631,314 | `7f88d332193381f8a370202a24ca15e7f000978e218cb02b9a97b2624fab94bc` |
| 2009-pussy | `2009 - Pussy.swf` | `originals/2009-pussy.swf` | 398,055 | `135dff5eae68c783ee639a79eef8298ba6faa6580efe1b71226ae1e8c44ce18f` |

The four `.exe` projectors (`2001-ich-will`, `2003-lichtspielhaus`,
`2004-reise-reise`, `2005-rosenrot`) and the WinZip self-extractor
(`2002-mutter`) are kept because they are the only original containers for
those movies.

## 3. Playable SWFs extracted from the projectors

For the five `.exe` cards the collection does **not** contain a standalone
`.swf`, so the movie embedded in the projector was extracted. These files are
*derived artifacts* in `assets/cards/<id>/player.swf`; the original `.exe`
files remain untouched in `originals/`. No bytes inside the movies were
modified. SHA-256 sums are stored in
[`assets/cards/SHA256SUMS`](assets/cards/SHA256SUMS).

| id | Source EXE | SWF offset | Signature | On-disk bytes | Declared SWF length | SHA-256 |
| --- | --- | ---: | --- | ---: | ---: | --- |
| 2001-ich-will | `2001 - Ich will.exe` | 376,832 | `FWS` v5 | 799,398 | 799,398 | `ee3b0b46ad3a9ef4989107afe60547afe910dc6c188427ed3c7db4f7576d16a6` |
| 2002-mutter | `2002 - Mutter.exe` → inner `ramm.exe` | 376,832 | `FWS` v5 | 643,921 | 643,921 | `e4393208817ec9fc8b034348d0be0e5a60e8e06a87428e206d0c9ed745590092` |
| 2003-lichtspielhaus | `2003 - Lichtspielhaus.exe` | 819,200 | `CWS` v6 | 1,203,021 | 1,282,417 | `2edc92d3959ec062602f827186300ca84b4131fa24fa9923532b82f91f1f6c66` |
| 2004-reise-reise | `2004 - Reise, Reise.exe` | 819,200 | `CWS` v6 | 2,164,414 | 2,459,541 | `f14ec32d33513790d8f8810206c80bfc0643d9e38336f8f9792a448d31bc9418` |
| 2005-rosenrot | `2005 - Rosenrot.exe` | 819,200 | `CWS` v6 | 1,454,732 | 1,697,900 | `5af8dab00fdf78f81e979dc665ad9f84d2b8f1cec347a8eb6a98f4e167edcc19` |

How each was obtained:

- **2001-ich-will** — the projector stub ends at offset 376,832 and the whole
  uncompressed `FWS` movie follows. The slice is exactly the declared 799,398
  bytes.
- **2002-mutter** — the outer EXE is a WinZip self-extractor (PE section
  `_winzip_`) containing one ZIP entry, `ramm.exe`; that inner projector again
  embeds an uncompressed `FWS` movie at offset 376,832, sliced to its declared
  643,921 bytes. This SWF is a *different movie* from `2001 - Mutter.swf`
  (1024×768 vs 650×400; 1,077 vs 2,260 timeline frames), and the archive
  contains no decompiled export for it.
- **2003 / 2004 / 2005 projectors** — the projector stub ends at offset
  819,200 and a zlib-compressed `CWS` movie follows. The stream was
  decompressed and its uncompressed body length matches the header's declared
  length (declared − 8 = decompressed body). Eight trailing padding bytes found
  after the zlib end in each file were removed; the saved file is exactly the
  compressed SWF, no more.

## 4. Timeline / dimension evidence

Every playable movie's header (signature, version, dimensions, frame rate,
timeline frame count) was parsed from the SWF itself and compared with the
frame-PNG count of the matching decompiled export. This is how each export
folder was mapped to its binary:

| id | Playable movie | SWF | Size | Frame rate | Timeline frames | Export `frames/` | Match |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 2001-mutter | `originals/2001-mutter.swf` | FWS v4 | 650×400 | 120 | 2,260 | 2,260 | yes |
| 2001-ich-will | extracted `player.swf` | FWS v5 | 795×590 | 45 | 1,031 | 1,031 | yes |
| 2002-mutter | extracted `player.swf` | FWS v5 | 1024×768 | 12 | 1,077 | none | n/a |
| 2003-lichtspielhaus | extracted `player.swf` | CWS v6 | 500×300 | 25 | 498 | 498 | yes |
| 2004-reise-reise | extracted `player.swf` | CWS v6 | 600×400 | 31 | 1,107 | 1,107 | yes |
| 2005-benzin-game | `originals/2005-benzin-game.swf` | FWS v7 | 600×450 | 30 | 14 | 14 | yes |
| 2005-keine-lust | `originals/2005-keine-lust.swf` | CWS v6 | 520×520 | 25 | 2 | 2 | yes |
| 2005-mann-gegen-mann | `originals/2005-mann-gegen-mann.swf` | CWS v8 | 500×630 | 25 | 541 | 541 | yes |
| 2005-rosenrot | extracted `player.swf` | CWS v6 | 628×471 | 31 | 297 | 297 | yes |
| 2005-rosenrot-single | `originals/2005-rosenrot-single.swf` | CWS v8 | 620×390 | 26 | 475 | 475 | yes |
| 2006-voelkerball | `originals/2006-voelkerball.swf` | CWS v8 | 850×650 | 25 | 899 | 899 | yes |
| 2009-lifad | `originals/2009-lifad.swf` | CWS v8 | 800×585 | 30 | 202 | 202 | yes |
| 2009-pussy | `originals/2009-pussy.swf` | CWS v8 | 1000×700 | 30 | 617 | 617 | yes |

(Dimensions are the SWF stage size in pixels; the decompiler's PNG exports are
one pixel wider/taller because of its export padding.)

## 5. Companion content — `assets/cards/<id>/`

### 5a. Supplied decompiler export (as found in the archive)

| id | Decompiled folder | texts/ | scripts/ | images/ | symbols.csv |
| --- | --- | ---: | ---: | ---: | --- |
| 2001-mutter | `Mutter/` | 2 | 4 | 24 | no |
| 2001-ich-will | `Ich will/` | 50 | 17 | 69 | yes |
| 2002-mutter | *(no folder; 13 JPEGs recovered from the SWF tags)* | 0 | 0 | 13 | no |
| 2003-lichtspielhaus | `Lichtspielhaus/` | 65 | 11 | 11 | yes |
| 2004-reise-reise | `Reise/` | 52 | 9 | 77 | no |
| 2005-benzin-game | `Benzin/` | 70 | 12 | 63 | yes |
| 2005-keine-lust | `Keine Lust/` | 70 | 3 | 10 | yes |
| 2005-mann-gegen-mann | `Mann gegen Mann/` | 47 | 4 | 10 | yes |
| 2005-rosenrot | `Rosenrot/` | 46 | 8 | 29 | yes |
| 2005-rosenrot-single | `Rosenrot Single/` | 9 | 14 | 9 | no |
| 2006-voelkerball | `Völkerball/` | 31 | 96 | 81 | yes |
| 2009-lifad | `LIFAD/` | 0 | 3 | 1 | no |
| 2009-pussy | `Pussy/` | 5 | 7 | 18 | no |

`scripts/` contains the supplied decompiler's ActionScript export (mostly
timeline actions). `images/` contains the supplied bitmap exports. `texts/`
contains the supplied text-field exports (many are empty fields).

### 5b. Complete FFDec re-decompile (added for the two incomplete cards)

The supplied export omits nested sprite/clip actions and inline button
handlers, which made it unusable for input analysis. All 13 playable movies
were therefore re-decompiled with **JPEXS Free Flash Decompiler 26.2.1**
(`benzin/tools/ffdec/ffdec.jar`, SHA-256
`090ab695053ad94cba6408574c7d7eea20ec60b6ae789ee6056a23f45106762f`, run on
OpenJDK 21). The complete exports were stored for the two cards that lacked
usable ones; for the other 11 the audit found no additional inputs and the
supplied export was kept.

| id | `scripts-ffdec/` | `texts-ffdec/` | Why stored |
| --- | ---: | ---: | --- |
| 2002-mutter | 109 `.as` | 363 `.txt` | No supplied export exists. Full script set documents inputs and the timeline; full text set documents the ecard copy. |
| 2005-benzin-game | 270 `.as` | 70 `.txt` | Supplied export had 12 timeline actions only; the complete export contains the frame_10 sprite clip actions with `Key.isDown(37/38/39/40)` and the in-card instruction texts (400–409). |

Encoding note: the 2002-mutter movie is SWF v5 and FFDec renders its font
code table as Shift-JIS single bytes, so some characters export mangled
(`PRﾄPARAT` for `PRÄPARAT`, `ﾖsterreich` for `Österreich`). The deterministic
halfwidth-katakana range was mapped back to CP1252 in the stored
`texts-ffdec/` files (215 files corrected); bytes outside that range remain
U+FFFD and are noted in the card's catalog entry. Scripts are ASCII and were
not affected materially.

### 5c. Deliberately not copied

| Category | Files | Approx. size | Reason |
| --- | ---: | ---: | --- |
| `frames/` timeline PNG renders | 7,943 | 1,313 MB | Redundant render of the movie timeline; one representative frame per card is used as the thumbnail instead. |
| `sprites/` symbol PNG exports | 23,836 | 299 MB | Redundant per-symbol renders (thousands of sprite frames). |
| `shapes/`, `morphshapes/` | 1,048 | 13 MB | Redundant vector-symbol renders. |
| `buttons/` | 203 | <1 MB | Redundant button-state renders. |
| `sounds/` | 84 (70 mp3, 14 wav) | 4.6 MB | Audio is played from the movie; not needed for catalog/UI work, and kept out of the repo. |
| `fonts/` | 39 `.ttf` | 0.9 MB | Embedded fonts are played from the movie; not needed for catalog/UI work. |
| `movies/` | 5 `.flv` | 2.2 MB | These are decompiler exports of embedded video streams (some 0 bytes); playback uses the movie's own streams. |

## 6. Thumbnails — `assets/thumbnails/<id>.jpg`

All thumbnails are real exports or renders derived from the archived movies,
scaled to a maximum of 480 px and encoded as JPEG (plus one bitmap pulled from a
SWF, because that card has no decompiled export). The separately supplied cards
document their own thumbnail sources in sections 13, 16 and 17. No thumbnail is
an invented or AI-generated image.

| id | Source | Note |
| --- | --- | --- |
| 1997-asche-zu-asche | Asche project `reference/extracted/title-screen.png` | Title screen of the preserved 1997 game; extracted from `RSTEIN.EXE` by the Asche project's `reference/extract_game_assets.py`. The game itself is hosted separately (see section 15). The 480×360 JPEG was scaled from the 640×480 PNG with ffmpeg. |
| 2001-mutter | `Mutter/frames/1131.png` | Green cross/logo frame from the timeline. |
| 2001-ich-will | `Ich will/images/110.jpg` | Bitmap export (Till Lindemann still). |
| 2002-mutter | `assets/cards/2002-mutter/images/embedded_01.jpg`, pulled from the movie's `DefineBitsJPEG2` tags | Bitmap extracted from the movie itself (no decompiled export exists); all 13 recovered JPEGs are kept in `assets/cards/2002-mutter/images/` and their hashes are in `assets/cards/SHA256SUMS`. |
| 2002-xxx-soundtrack | `originals/2002-xxx-soundtrack.swf`, FFDec 26.2.1 frame render (timeline frame 470) | The animated xXx logo on the card's red grid. The separately supplied movie has no decompiled export, so the frame was rendered from the SWF itself; 450×200, JPEG. |
| 2003-lichtspielhaus | `Lichtspielhaus/frames/125.png` | Title screen. |
| 2004-reise-reise | `Reise/images/126.jpg` | Bitmap export (band in the field). |
| 2005-benzin-game | `Benzin/frames/11.png` | Gameplay frame. |
| 2005-keine-lust | `Keine Lust/images/194.jpg` | Supplied giraffe single artwork; replaces the black timeline-frame thumbnail after browser visual review. |
| 2005-mann-gegen-mann | `Mann gegen Mann/images/72.jpg` | Bitmap export (single artwork still). |
| 2005-rosenrot | `Rosenrot/frames/223.png` | Ship-in-ice scene. |
| 2005-rosenrot-single | `Rosenrot Single/frames/119.png` | Video still with title. |
| 2006-voelkerball | `Völkerball/frames/450.png` | Fan poster (Nîmes / Moskau / London / Tokio). |
| 2009-lifad | `LIFAD/frames/202.png` | Album artwork. |
| 2009-pussy | `Pussy/frames/309.png` | Single artwork (band, pink dividers). |

## 7. Controls and keyboard needs

An earlier pass searched only the supplied decompiled exports and the SWF
string tables and found no keyboard use. **That was not sufficient**: inline
clip actions and nested sprite actions do not appear in the supplied exports,
and key checks such as `Key.isDown(38)` are not visible as readable strings in
the raw SWF. The full FFDec 26.2.1 decompile (section 5b, all 13 playable
movies) replaces that conclusion:

| id | Keyboard in the movie | Evidence |
| --- | --- | --- |
| 2005-benzin-game | **Yes — gameplay** | `scripts-ffdec/frame_10/PlaceObject2_399_2/CLIPACTIONRECORD onClipEvent(enterFrame).as` uses `Key.isDown(38)` (accelerate) and `Key.isDown(40)` (brake); `PlaceObject2_477_149` uses `Key.isDown(39)` (right) and `Key.isDown(37)` (left). In-card labels: 404 `Accélerer`, 405 `Freiner`, 406 `Tourner à gauche`, 407 `Tourner à droite`. |
| 2005-keine-lust | Form components only | The generated Flash 6 form classes (`FComboBoxSymbol`, `FScrollSelectListSymbol`, `FRadioButtonSymbol`, `FCheckBoxSymbol`, `FUIComponentSymbol`) handle Enter/Space/arrow keys for the mailing-list sign-up form. No gameplay keys. |
| 2001-mutter | No | Full export: only `on(release)` getURL handlers. |
| 2001-ich-will | No | Full export: mouse-position math (`_root._xmouse/_ymouse`) and button handlers. |
| 2002-mutter | No | Full export: only `on(press)`, `on(release)` and `on(rollOver)` handlers. |
| 2003-lichtspielhaus | No | Full export: button/console handlers only. |
| 2004-reise-reise | No | Full export: language/navigation button handlers only. |
| 2005-mann-gegen-mann | No | Full export: button handlers only. |
| 2005-rosenrot | No | Full export: language/navigation and sound attachment only. |
| 2005-rosenrot-single | No | Full export: preloader and form handlers only. |
| 2006-voelkerball | No | Full export: navigation, gallery and form handlers only. |
| 2009-lifad | No | Full export: preloader and navigation. |
| 2009-pussy | No | Full export: preloaders, sound fade, navigation. |

Other input notes:

- Interaction is otherwise **mouse/pointer**: menu buttons use
  `onPress`/`onRelease`; `2001-ich-will` reads `_root._xmouse/_ymouse`
  (`woistdieMaus`, `d_maus`).
- Several movies send projector FSCommands on their first frame
  (`fullscreen`, `allowscale`, `showmenu`). These are projector directives; the
  browser wrapper is expected to make its own scaling/fullscreen decisions.
- Implication for the wrapper: only `2005-benzin-game` needs key events
  forwarded (Arrow Up/Down/Left/Right); its catalog `controls` uses
  `{ "key": ..., "label": ... }` objects that the existing launcher's
  `expandControls` maps to touch controls. No other card needs key mapping.

## 8. Embedded URLs (content references, not provenance)

These strings live inside the movies/scripts. They document what the cards
tried to reach historically; they are **not** the source of this archive and
are not evidence of any official download page. Availability was **not tested**
in this workstream; treat them as historical/unverified.

| Card | Key references |
| --- | --- |
| 2001-ich-will | `http://php.rammstein.de/ich-will/send-to-a-friend.php`; `http://www.rammstein.de/_sounds/g2/ichwillfinal.ram`; Amazon ASIN link; motor.de |
| 2002-mutter | `http://www.rammstein.de/_mutter/track01..11.ram` and `sonne.ram`; `rtsp://ra.universal-music-group.com:554/rstein/sonne-128.rm`; `http://php.rammstein.de/send_ecard.php`; `http://www.rammstein.com`; RealPlayer download; Amazon ASIN links; motor.de; tickets-per-post.de; surver.net |
| 2003-lichtspielhaus | `ginza.se`, `motordiscs.de`, `virginiarecords.com`, motor.de send-to-a-friend form |
| 2004-reise-reise | `http://www.universal-rock.de/specials/ecards/rammstein/scripts_reisereise_ecard/`; universal-rock.de frameloader URL; rammstein.com/de |
| 2005-benzin-game | `http://rammsteingame.artistes.universalmusic.fr/acces/hits.php`; relative `acces/*.php`, `benzin1.flv`, `listpays.xml`; teemic.com |
| 2005-keine-lust | 12 `http://exodus.interoutemediaservices.com/deliverMedia.asp?id=...` video streams; `audio/trackN.mp3`; hyperlaunch.com registration/send pages; islandrecords.co.uk; universalbuybutton.com; Real/Windows Media player links |
| 2005-mann-gegen-mann | `http://myprofile.universal-music.de/interface/web_subscribe.php`; universal-rock.de send2Friend (de/en) and newsletter pages; universal-download.de shoplocator; rammsteinshop.de; rammstein.com/de |
| 2005-rosenrot | `http://www.universal-rock.de/specials/ecards/rammstein_rosenrot/rammstein_benzin.swf`; send2Friend/send2Friend_en/sendCoremailer; rammstein.com Extras/Intreleasedates |
| 2005-rosenrot-single | `http://coremailer.universal-music-group.com/mlg/servlet/mlist`; `http://www.rammstein.de` |
| 2006-voelkerball | `getFile.php?PW=...`; `http://myprofile.universal-music.de/...`; vertigo.fm shop/send2Friend; amazon.de/bFast links; rammsteinshop.de; pilgrim-management.de |
| 2009-lifad | `http://www.rammstein.de` |
| 2009-pussy | `http://www.visit-x.net/rammstein`; `http://www.rammstein.de/blog/lang/en/` |

The full per-file URL set extracted from the FFDec exports is reproducible from
`scripts-ffdec/` for the two stored cards and from the supplied `scripts/`
otherwise.

## 9. Known dependencies and missing files

Keine Lust's absent music-player companion `player_txt.txt` has a separately
documented reconstruction in `patches/keine-lust/`, copied byte-for-byte to the
SWF directory as `originals/player_txt.txt` for deployment. This added companion
is reconstructed, unlike the 13 unchanged binaries in that directory.
The track title comes from embedded text; a one-track
count is an inference. No audio was recovered and no original SWF was changed.
See `qa/KEINE-LUST-REPAIR.md` for menu verification and reconstruction evidence.

| Card | Dependency | Status |
| --- | --- | --- |
| 2005-benzin-game | `benzin1.flv` (relative, played via `NetStream`) | **Missing** from the archive; the video segment cannot load. `movies/254.flv` exported 0 bytes. |
| 2005-benzin-game | `listpays.xml` and `acces/*.php` score/newsletter endpoints | Not in the archive; historical remote service, availability not verified. |
| 2003-lichtspielhaus | relative `flash/*.swf` modules (`openvideo()` builds `flash/trailer.swf`, …) | **Missing** from the archive; some console sections may not open. |
| 2004-reise-reise | `universal-rock.de` ecard scripts / frameloader; send2Friend/sendCoremailer | Historical remote service, availability not verified; the local movie still plays. |
| 2005-keine-lust | 12 `exodus.interoutemediaservices.com` video streams; relative `audio/trackN.mp3` files | Historical remote service / not in the archive; availability not verified. |
| 2005-mann-gegen-mann | `SteelExternalAll.swf` (FLVPlayback skin); `rammstein_22sec_clean.flv`; universal-rock.de/myprofile endpoints | **Missing** skin/FLV; endpoints historical, availability not verified. |
| 2005-rosenrot | `rammstein_benzin.swf` (the linked Benzin game); send2Friend/sendCoremailer | Historical remote files; availability not verified. |
| 2005-rosenrot-single | `coremailer.universal-music-group.com` mail servlet | Historical remote service, availability not verified. |
| 2006-voelkerball | `getFile.php?PW=` preview; `rst_voelkerball_wallpaper_1..9.jpg`; myprofile/vertigo endpoints | Wallpapers and services not in the archive; availability not verified. |
| 2001-ich-will | `php.rammstein.de` form; `ichwillfinal.ram` | Historical remote files, availability not verified. |
| 2002-mutter | `rammstein.de/_mutter/*.ram` and `rtsp://` Sonne stream; `php.rammstein.de/send_ecard.php`; RealPlayer | Historical remote files, availability not verified; no decompiled export exists in the archive. |
| 2009-lifad, 2003-lichtspielhaus, 2005-mann-gegen-mann | embedded video streams (exported as `movies/*.flv`) | Contained in the movies; the FLV export files were not copied. |

Movie-tag inspection of all 13 playable SWFs found **no `ImportAssets` /
`ImportAssets2` tags**, so no movie tries to import symbols from an external
SWF. Embedded video streams (`DefineVideoStream`) are present in
`2005-benzin-game` (1), `2003-lichtspielhaus` (1), `2005-mann-gegen-mann` (2)
and `2009-lifad` (1); the Benzin movie additionally requests the external
`benzin1.flv` through `NetStream`. Embedded lossless bitmaps exist in
`2002-mutter` (5), `2004-reise-reise` (1), `2005-rosenrot` (1),
`2005-mann-gegen-mann` (1) and `2006-voelkerball` (3). Only
`2006-voelkerball` carries an SWF `Metadata` RDF tag (title
`Rammstein - Völkerball`, no date).

### Benzin companion research (independent project)

An independent project in the same workspace (`/root/repos/rammwiki/benzin`)
holds `assets/original.swf` with SHA-256
`d22a3d9f6f7abde09a19aa29ab6a8ec12317c388e2ec900ca0e7697fd1694249` — byte-identical
to the supplied archive's Benzin movie — and records its source as
`https://www.rammsteinworld.com/download/benzin.swf` with a matching checksum.
Its `reference/original-as2/` decompile (produced from that identical file)
agrees with our FFDec export on the four `Key.isDown` calls. The project's
community rebuild modifies menus and the leaderboard plumbing but does **not**
repair the video: no `benzin1.flv` exists there, the embedded
`DefineVideoStream` still exports 0 bytes, and the community SWF keeps the
original `NetStream` path. **No patched community SWF was copied into this
repo**; `originals/2005-benzin-game.swf` remains the unmodified supplied file.

## 10. Year evidence

Policy applied in `catalog.json`:

- Archive filename prefixes are **labels, not dates**. They are recorded in the
  card `notes` but the `year` field stays `null` unless a year is corroborated
  by an embedded date or a reliable documented source.
- For the two Mutter entries, whose titles would otherwise collide, the title
  carries the archive label: `Mutter — archive 2001` and
  `Mutter — archive 2002`.

| id | year | Evidence |
| --- | ---: | --- |
| 2001-mutter | null | Archive label 2001; no date embedded (texts only `SKIP`). |
| 2001-ich-will | 2001 | Embedded text `RELEASE 10_09_2001` (repeated status lines). |
| 2002-mutter | null | Archive label 2002; embedded strings reference the 2001 Mutter album/tour (`ALBUM MUTTER- 2001`, `RAMMSTEIN TOURDATES 2001`, `KONSERVIERUNG: JAN 2001`) but no release date for the piece. |
| 2003-lichtspielhaus | null | Archive label 2003; only embedded date is the competition deadline `ZUM 28.02.04`. |
| 2004-reise-reise | 2004 | Embedded `Das neue Album am 27. September 2004.` / `New Album. Out September 27th 2004.` and Nov/Dec 2004 tour lists. |
| 2005-benzin-game | null | Archive label 2005; intro artwork announces `Nouvel album sortie le 28 octobre` without a year. |
| 2005-keine-lust | null | Archive label 2005; form text says `OUT 28TH FEBRUARY` with no year; UK tour dates carry no year. |
| 2005-mann-gegen-mann | 2006 | Embedded `ab 03.03.06` (de) / `out 03.03.06` (en). |
| 2005-rosenrot | null | Embedded track listing cites live recordings from February, June and July 2005, but recording dates do not independently establish this card's release year. |
| 2005-rosenrot-single | 2005 | Embedded `Subscribe ... by 20 December 2005`. |
| 2006-voelkerball | 2006 | Embedded `COPYRIGHT © 1997 - 2006 RAMMSTEIN & PILGRIM MANAGEMENT`; RDF metadata has no date. |
| 2009-lifad | null | Archive label 2009; no date-bearing text found. |
| 2009-pussy | 2009 | Embedded `SEP. 16TH 2009`. |

## 11. Verification status

Verified in this workstream:

- The source ZIP was hashed (SHA-256 above) and its central directory inspected.
- All 13 originals were re-extracted and their CRC-32 checked against the ZIP;
  SHA-256 recorded in `originals/SHA256SUMS`.
- SWF headers were parsed independently for all 13 playable movies
  (signature/version, stage size, frame rate, timeline frames) — see section 4.
- The 5 projector extractions were validated by decompressing/parsing the
  embedded movie; for the 4 that have a decompiled export, the timeline frame
  count matches the corresponding `frames/` export (section 4). Trailing bytes
  after the zlib stream were removed from the 3 compressed extracts.
- All 13 playable movies were fully re-decompiled with FFDec 26.2.1 and audited
  for key APIs and external references; the Benzin keyboard controls in
  section 7 were confirmed both in the clip actions and in the in-card
  instruction labels.
- The Benzin original matches an independent, checksum-documented copy
  (section 9).
- Thumbnails were produced with ffmpeg from real exports and were checked for
  decodability; a contact-sheet review was used to reject black/blank frames.

**Outside the extraction audit:**

- Runtime playback was tested separately after extraction. See
  [VERIFICATION.md](VERIFICATION.md) for the browser results; catalog status
  labels reflect that later testing, not merely a successful extraction.
- Interaction, audio, video decoding and network-dependent behaviour of any
  card, including the historical endpoints in sections 8 and 9 (they were not
  contacted and are not claimed to be dead).
- The contents of `2002-mutter` beyond what FFDec/bitmap extraction reveals
  (there is no supplied decompiled export to compare against).
- The charset-mangled characters of the 2002-mutter texts outside the
  recoverable range (marked U+FFFD).

Also note: the supplied decompiled `.as` exports cover timeline actions and are
incomplete for some movies (notably `2005-benzin-game`, whose sprite/button
logic is not fully present). Conclusions about inputs are based on the complete
FFDec exports, not on the supplied ones.

## 12. Reproduction

The build used Python 3 (stdlib: `zipfile`, `zlib`, `struct`, `hashlib`),
`ffmpeg` for thumbnails, and JPEXS FFDec 26.2.1 for script/text exports:

1. list the ZIP, extract the 13 top-level binaries, verify CRC-32 and SHA-256;
2. locate `FWS`/`CWS` magic in the five projectors, extract and validate the
   embedded movies;
3. copy `texts/`, `scripts/`, `images/` and `symbols.csv` per card;
4. re-decompile with
   `java -jar ffdec.jar -export script,text <outdir> <movie.swf>`; for the
   SWF v5 Mutter movie, map halfwidth-katakana export artifacts back to
   CP1252;
5. audit the exports for `Key.*`, `onKeyDown/Up`, external URLs and relative
   file references;
6. derive thumbnails at ≤480 px from the sources in section 6;
7. write `catalog.json`.

No SWF bytes were modified. Supplied decompiler exports were preserved as found;
new FFDec text exports for the 2002 Mutter card received the encoding correction
documented in section 5b. Files/directories use the ASCII slugs listed in section
2; the original ZIP paths are preserved in this document.

## 13. RAMMSTEIN Screensaver (1999) — separate source archive

This card is **not** from `Flashcards.zip`. It comes from a second user-supplied
archive and is documented with the same rules: originals byte-for-byte, derived
artifacts labelled, and nothing claimed as verified that was not exercised.

| Property | Value |
| --- | --- |
| File | `/home/mrzetti/downloads/RST_screensaver.zip` (user-supplied) |
| Size | 1,193,571 bytes |
| Modified | 2026-09-14 03:35 UTC |
| SHA-256 | `9a792baa025966b1b6b742f651d0511f9a94111c50ec1bfa70ac88dbdbb7d5c6` |
| ZIP entries | `readme.txt`, `RST_installer.exe` (2 files) |
| Repo originals | `originals/1999-rst-screensaver.zip`, `originals/1999-rst-screensaver-installer.exe`, `originals/1999-rst-screensaver-readme.txt` |

The readme is a bilingual German/English note dated 1999: "RAMMSTEIN
screensaver", (p)+(c) 1999 Motor Music, Hamburg, concept/design/programming
Guido Raschke, version `091199_R2.2_WIN`, for Windows 95/98/(NT4.0), 16-bit
graphics at 800×600. The movie's own credits plate repeats the year and version
(`version R2.2, 09.11.1999`); the card's `year: 1999` is supported by both. No
download URL, author page or official product page is recorded in this repo.

### 13.1 What the installer contains

`RST_installer.exe` (2,874,948 bytes,
`23882404385ebd932e4ff40e67e361c2069c92839955bf31dfb2cbcc68383bb6`) is a 16-bit
Windows **NE** program. Its resources are 3 dialog BITMAPs, 2 ICONs (16×16 and
32×32), a menu, 3 dialogs, 2 STRING tables and a VERSION resource; the raw
resources are preserved under `assets/cards/1999-rst-screensaver/installer/` with
PNG/ICO conversions for viewing.

The code payloads were located and carved by scanning for valid MZ/PE/NE
headers:

| Region | Content | Carved as |
| --- | --- | --- |
| `0x2dce0` | 16-bit `MICKEY16` helper (keyboard/mouse hooks) | `payload/MICKEY16.bin` |
| `0x2ed70` | 32-bit helper image | `payload/payload_0x02ed70.bin` |
| `0x5bd70` | 32-bit `MICKEY32` helper image | `payload/payload_0x05bd70.bin` |
| `0x94188` → EOF | 32-bit Director 6/MacroMix projector `RST_saver.exe` | `RST_saver.exe` |
| inside it, `0x1ed696` | 16-bit player image | `payload/player16.bin` |
| inside it, `0x1fce96` | 32-bit player image | `payload/player32.bin` |

`RST_saver.exe` (2,268,348 bytes,
`079843ee82be694fc389bdd2739a9ccf5b476247ddd38cd7fc856f1b22d6fe4d`) is exactly
`installer[0x94188:]`; the protected movie's memory-map offsets are relative to
that address, so the byte range is the executable the installer installs. The
16-bit player and the Mickey files are preserved but were not analysed further.

### 13.2 Reconstructing the protected Director movie

The projector is a Macromedia Director 6.0.2 "MacroMix" projector whose movie
(`source_4.dir`, per the author path string `=Baracuda Eins:RST_new
screensaver:4th_generation:source_4.dir`) is stored as scattered chunks with a
memory map rather than as a contiguous `.dir`. The map at projector offset
`0x16ea7c` lists 725 used slots; the header at `0x16ea50` is
`XFIR`/`MV93` (Director 5/6, Windows byte order).

A standard Windows Director file was rebuilt by gathering the 304 real chunks in
map order, rewriting the `imap`/`mmap` offsets and rewriting the `RIFX` length,
mirroring ProjectorRays' writer layout:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `movie/source_4.dir` (repo: `assets/cards/1999-rst-screensaver/source_4.dir`) | 766,315 | `8743300711db88b1b8f1c5a515c10bc3de17c95750c6bc2b197784b5e4ee3e7d` |
| `movie/source_4_decompiled.dir` (ProjectorRays 0.2.1, commit `6f9bceb`) | 768,202 | `8ac56bab913f3e83ed669146acb2ff3e794a9f77d778f8a51eef8126f64b54ee` |

The reconstruction was done twice — once from the installer, once from the
carved `RST_saver.exe` — and both runs produced the identical SHA-256 above.
ProjectorRays decompiled the movie as "Macromedia Director 6.0" and restored 26
Lingo scripts (score, movie, parent and behaviour scripts), stored under
`scripts/`. The reconstructed `.dir` is a derived artifact: the pixels, texts
and scripts are original, but the container layout is not the original
byte-for-byte protected form (which remains inside `RST_saver.exe`).

### 13.3 Sprites, labels and manifests

The movie's `KEY*` table maps each cast member to its child resources. All 103
bitmap members are 8-bit (`BITD` chunks, built-in system palette, clut id 0);
they were decoded with a Python port of ScummVM's Director `BITDDecoder` (RLE
and de-interleaving) and written as palette-indexed PNGs under `sprites/`. The
clean renders use ScummVM's `macPalette` system-palette table; the Windows
palette table renders the same frames as rainbow noise, and the `macPalette`
renders reproduce the frames' intended grey/red/green look. Five button labels
are stored in `texts/` (decoded as MacRoman: `TAFELN_A`, `TAFELN_B`, `KREUZE
(Zufallsprinzip)`, `scharfmachen & zurück`, `Geschichte`). `cast.json` records
every member (id, name, type, size, resources); `scene.json` groups the preview
sequences. The card thumbnail is a **derived composite** of three original
sprites (frame `rahmen32`, plate named `20`, a red-cross frame) and is not an
original asset.

| Bundle | Content | SHA-256 |
| --- | --- | --- |
| `sprites.zip` | 103 PNGs + `cast.json` + `scene.json` | `6198c3f5d530a897bbbda8b21666394865d962af2747c9611688ae4bbb9f8425` |
| `RST_screensaver_extracted.zip` | readme, `RST_saver.exe`, both movies, sprites, scripts, texts, installer resources, payloads | `5ac492847979f9e26565e7f6a2bfa19a6fba7d900c960b20d6fdf15d05b98162` |

### 13.4 Deliberately not reconstructed

- **Film-loop playback.** The cast contains nine film loops (`red_cross`,
  `green_cross`, `burning_red`, `burning_green`, `burning_start`, `flamme`,
  `flamme_versetzt`, `leer`); their frame ordering could not be recovered from
  the `SCVW` window-shape references, so the browser preview animates the
  individually named frames (`f01`–`f33`, `g01`–`g18`, `AA f00020`–`f00036`)
  instead.
- **Sound.** The movie contains no `snd ` chunks; the original is silent.
- **Original runtime execution.** The program was not run: it requires 16/32-bit
  Windows. It is preserved as bytes; the browser page is a sprite preview, not a
  Director emulator. No claim is made that `RST_saver.exe` still runs on a
  specific machine.

### 13.5 Reproduction

1. `unzip RST_screensaver.zip`; keep `readme.txt` and `RST_installer.exe`.
2. Parse the NE resources; carve the payloads listed in 13.1.
3. Rebuild `source_4.dir` from the projector's `imap`/`mmap` chunk map (base
   `0x94188`; chunks at map offsets).
4. `projectorrays decompile source_4.dir -o out --dump-scripts --dump-chunks
   --dump-json` (ProjectorRays 0.2.1); scripts are written per cast.
5. Decode `BITD-*.bin` with the ScummVM `BITDDecoder` algorithm and the movie's
   system palette; match cast members through the `KEY*` child table.
6. Compare every output against `assets/cards/SHA256SUMS`.

## 14. Launcher branding

The desktop chrome, wallpaper and icons are original CSS/SVG work for this
launcher; no Microsoft or third-party theme files are bundled. The only branded
asset is the RammWiki wordmark in `assets/brand/rammwiki-wordmark.svg`, fetched
2026-09-14 from https://ramm.wiki/w/rammwiki.svg and kept byte-for-byte:

| File | SHA-256 |
| --- | --- |
| `assets/brand/rammwiki-wordmark.svg` | `9c891808b241d5d9658fed10c71da1ab97dd96f10a11704c5c53894dda62b5b9` |

It is not part of the preserved card collection. It is used to identify the
RammWiki project this desktop belongs to and remains RammWiki property; see
`THIRD_PARTY.md`.

## 15. Asche zu Asche browser game card

The `1997-asche-zu-asche` catalog entry is not a Flash card: it embeds the
separately preserved 1997 Windows game from https://asche.rammwiki.mrzetti.com
(repository: https://github.com/mrzetti/asche) through its `?embed=1` compact
player. That project documents the original executable, VB3 runtime, custom DLL,
audio, Boxedwine/Wine runtime and extraction hashes; none of those files are
duplicated here.

- Thumbnail: `assets/thumbnails/1997-asche-zu-asche.jpg`, derived from the
  Asche project's extracted title screen (see section 6).
- The desktop only frames the game page: nothing downloads until the visitor
  chooses **Load game**, and closing the window releases the emulator.
- Embedding needs cross-origin isolation. This site sends
  `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp`; the Asche deployment sends the
  matching headers with `Cross-Origin-Resource-Policy: same-site` so its sibling
  subdomain may frame it.
- Verification of the live embed is recorded in `VERIFICATION.md`.

## 16. Mutter Enhanced CD (2001) — separate source archive

This card is **not** from `Flashcards.zip`. It comes from a third user-supplied
archive and follows the same rules as sections 13–15: originals are preserved
byte-for-byte, derived artifacts are labelled, and nothing is claimed as
verified that was not exercised.

| Property | Value |
| --- | --- |
| File | `/home/mrzetti/downloads/Enhanced CD.zip` (user-supplied) |
| Size | 42,910,329 bytes |
| Modified | 2026-09-14 15:06 UTC |
| SHA-256 | `7d223b948c5ea680336d9c96e25501d4b28e017a848b254e508606261bb3ace9` |
| ZIP entries | 38 (5 directories + 32 files) |
| Repo tree | `originals/2001-mutter-enhanced-cd/` (32 files, byte-for-byte) |

The archive is a plain ZIP of the Windows data session of a CD Extra /
Enhanced CD. The files were extracted to `originals/2001-mutter-enhanced-cd/`
with the ZIP's top-level `Enhanced CD/` folder removed; every file's SHA-256 is
recorded in `originals/SHA256SUMS`, and all CRCs were checked against the ZIP
central directory during extraction. The ZIP container itself is not deployed:
its only large entry, the 41.4 MB `Movies/Sonne.MPG`, is preserved directly, so
shipping the container would only duplicate it. The 2023-03-15 timestamps on
the ZIP entries are the user's extraction date, not disc-mastering metadata;
the received archive's own SHA-256 is the value above.

### 16.1 Identification

`AUTORUN.INF` `[ID]` describes the disc as `DiscName=Mutter`,
`Label=Universal Records`, `Selection#=314549639-2`. That selection number
matches the enhanced second disc of the US limited edition (Discogs release
614817: Republic Records / Universal Records, CD + Enhanced CD, released
2 April 2001); the documented release supplies the card's `year: 2001`.
`[AlbumCredits]` names the album and artist (`AlbumName=Mutter`,
`ArtistName=Rammstein`) and `[SongID]` lists the eleven album tracks. The
songs themselves play from the CD audio session and are not part of the data
session; the supplied archive contains no audio tracks. The archive's
`Movies/Icon_` entry is an empty 0-byte placeholder and is preserved as such.

### 16.2 Contents

| File(s) | Bytes | Content |
| --- | ---: | --- |
| `Movies/Sonne.MPG` | 41,366,260 | The Sonne music video: MPEG-1 program stream, video 352×240 (SAR 200:219), 29.97 fps, ~1,140 kb/s; MP2 stereo 224 kb/s, 44.1 kHz; 4:00.17. |
| `Mutter.CDQ` | 17,596 | Universal Media Player presentation data; see 16.4. |
| `ReadThis.WRI` | 243,834 | The player's generic manual as a Windows Write/RTF document, including an embedded Paint bitmap of the toolbar (the object is not extracted as a file; the text is). |
| `AUTORUN.INF` | 3,751 | Disc identification, content map, song list, historical links and the UMP install/browser setup. |
| `Text/About The Video`, `Text/Video.txt` | 904 / 979 | Generic notes about the disc's video and the required players. |
| `Images/FrontLg.jpg`, `FrontMed.jpg`, `FrontSm.jpg` | 65,725 / 24,548 / 9,925 | The album front cover at three sizes. |
| `PICTURES/JACKET01.00J` | 4,253 | JPEG, 240×240: the “Enhanced CD” plate. |
| `PICTURES/JACKET01.00N/.00S/.00T` | 7,100 / 32,972 / 16,508 | The “CD Extra” plate as single-frame MPEG-1 video (176×112, 704×480, 352×240) wrapped in a RIFF/`CDXA` form. |
| `CDPLUS/INFO.CDP`, `CDPLUS/SUB_INFO.en` | 2,048 / 580 | CD-Text / CD-Plus media; the track fields are unfilled placeholders (“Track 01”…). |
| `SETUP.EXE`, `setup.ins`, `setup.lid`, `SETUP.INI`, `lang.dat`, `layout.bin`, `os.dat`, `data1.cab`, `_sys1.cab`, `_user1.cab`, `_INST32I.EX_`, `_ISDEL.EXE`, `_SETUP.DLL` | 960,788 total | InstallShield 5 installer for the Universal Media Player. |
| `Startup.exe` | 40,960 | The LocalAutorun launcher named by `AUTORUN.INF` (`[LocalAutorun]`). |
| `DATA.TAG` | 120 | Universal Music Group “Universal Media Player 0.30” tag. |

### 16.3 Universal Media Player

`data1.cab` holds the player itself; its two members were extracted with
`unshield 1.5.1` (`unshield -O`, the old decompressor; the extraction was run
twice into separate directories and produced identical hashes):

- `ump.exe` (641,536 bytes) is a 32-bit GUI PE (6 sections, linker timestamp
  1998-02-27 22:38 UTC, file version 1,0,0,1, original filename `LB.EXE`,
  copyright “© 1997”). Its bitmap resources include the 224×32 toolbar
  (pairs of 32×16 normal/disabled images: lyre, filmstrip, globe, eye,
  question mark, two arrows) and the 489×219 About screen. That About screen
  credits **Thinking Pictures Incorporated**, 448 W16th Street, New York
  NY 10011, phone/fax 212.989.3950/4962, `info@thinkpix.com`; software Ed
  Herranz; GUI Stephan Fitch – Ed Herranz; graphics David Oppenheim – David
  Segolowitz; ECD authoring automation Howard Soroka – Modern Methods; and an
  “Extended ECD Standard” by Howard Soroka (Modern Methods) and Ed Herranz
  (TPI). Other strings include `http://www.rock.com/ecd`,
  `Software\LocalAutorun\Media`, `Setup.bmp`, `*Loading CD*`, `*Empty*` and
  the toolbar labels `Help`, `Audio`, `Video`, `Media`, `Connect`.
- `ump.ico` (592 bytes) is stored in the cabinet as a 32×32 4-bit DIB rather
  than an ICO container; it was converted to PNG for the preview and to the
  `ump-icon.png` on the card.

The manual states the requirements (Windows 95, Pentium, 8 MB RAM, thousands
of colours, double-speed CD-ROM) and that video needs QuickTime 3/2.1.2 or
Microsoft Media Player; the player's own installer is started from the disc.
The archive contains no QuickTime installers and no Mac “CD Extra” side, both
of which `AUTORUN.INF` references. **The player was not executed**: it is a
16/32-bit Windows program and this project does not run it. The browser
preview is a rebuild, not an emulator.

### 16.4 Mutter.CDQ

`Mutter.CDQ` (named after the disc) is the player's presentation data. It is a
big-endian container of `size`+4CC atoms: a root `quac` atom (1,520 bytes)
holding `vcd `, `lgin`/`lang`, `alid` and `albm`/`alin` with `enco`/`blue`,
`name`, `part`, `frpc`/`pict`, one global `cast` and eleven `trin` records
(`trno`, `name`, `seam`, `part`, and a nested `cast` with `name`/`role`/`cont`),
followed by a `data` atom (16,076 bytes). The records contain offset/length
pairs that point into a string table with the values “Artist”, “Principal
Artist” and “Track 01”–“Track 11”; the `pict` record points at a PICT v2 image
inside the `data` atom that decodes to the same “Enhanced CD” plate as
`PICTURES/JACKET01.00J`. No decoder is shipped; the file is preserved as bytes
and the structure above was observed for documentation, not executed.

### 16.5 Derived artifacts

| Repo file | Source | How |
| --- | --- | --- |
| `assets/cards/2001-mutter-enhanced-cd/ump.exe` | `data1.cab` → `ump.exe` | `unshield -O` extraction. SHA-256 `bc793800…f85f6d`. |
| `assets/cards/2001-mutter-enhanced-cd/ump.ico` | `data1.cab` → `ump.ico` | `unshield -O` extraction. SHA-256 `1ce0460d…a043ab`. |
| `assets/cards/2001-mutter-enhanced-cd/ump-icon.png` | `ump.ico` | ffmpeg DIB→PNG, 32×32. |
| `assets/cards/2001-mutter-enhanced-cd/ump-toolbar.png` | `ump.exe` bitmap 128 | `wrestool` extraction, BMP→PNG. |
| `assets/cards/2001-mutter-enhanced-cd/ump-icons.png` | `ump.exe` bitmap 128 | Top 16 px of each 32×16 cell; used as the preview's icon sprite. |
| `assets/cards/2001-mutter-enhanced-cd/ump-about.png` | `ump.exe` bitmap 161 | `wrestool` extraction, BMP→PNG. |
| `assets/cards/2001-mutter-enhanced-cd/setup-banner.png` | `setup.bmp` | ffmpeg BMP→PNG. |
| `assets/cards/2001-mutter-enhanced-cd/readthis.txt` | `ReadThis.WRI` | RTF text extraction; the embedded Paint object is omitted. |
| `assets/cards/2001-mutter-enhanced-cd/sonne-preview.mp4` | `Movies/Sonne.MPG` | `ffmpeg -i … -map 0 -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart` (11.4 MB; the original file is unchanged). SHA-256 `e18a9840…36b6d6e6`. |
| `assets/cards/2001-mutter-enhanced-cd/sonne-poster.jpg` | `Movies/Sonne.MPG` | Frame at 2:45, scaled to 322×240 with LANCZOS, JPEG q≈85. |
| `assets/thumbnails/2001-mutter-enhanced-cd.jpg` | `Movies/Sonne.MPG` | The same 2:45 frame, cropped to the active 322×162 video area (rows 40–201, black letterbox bars removed), JPEG q≈85. A real video frame, no composite or invented artwork. |

All derived files are hashed in `assets/cards/SHA256SUMS` except the thumbnail,
matching the existing thumbnail convention.

### 16.6 Browser preview

`mutter-ecd.html` + `mutter-ecd.js` rebuild the Universal Media Player window
from the preserved files: the album artwork and plates, the Sonne transcode
with its original poster frame, the eleven track entries and three links parsed
from `AUTORUN.INF`, the toolbar sprite rendered from `ump.exe`, the extracted
manual and the historical addresses as text. The page fetches only its own
site's files; the original Windows program and the original MPEG-1 are card
downloads, not browser plugins. The page is not the original program.

### 16.7 Reproduction

Tools used: Python 3 (stdlib), `unshield 1.5.1`, `icoutils` (`wrestool`),
ffmpeg 6.1, and a browser for the preview checks.

1. `unzip "Enhanced CD.zip"`; verify every CRC and copy the tree to
   `originals/2001-mutter-enhanced-cd/` (top-level `Enhanced CD/` removed).
2. `unshield -O -d out x "Enhanced CD/data1.cab"` → `ump.exe`, `ump.ico`;
   `python3 -m pefile`-style inspection and `wrestool -l` verify the PE and
   its resources.
3. `wrestool -x -t bitmap -o out ump.exe`; render/convert with ffmpeg; crop the
   top 16 px of each 32×16 toolbar cell into `ump-icons.png`.
4. Transcode the video, extract the poster and thumbnail frames (commands in
   16.5), crop the thumbnail with ffmpeg.
5. Extract the RTF text of `ReadThis.WRI`, skipping the embedded object group.
6. Compare every output against `originals/SHA256SUMS` and
   `assets/cards/SHA256SUMS` with `python3 qa/validate_catalog.py`.

## 17. xXx (Triple X) soundtrack e-card (2002) — separate source archive

This card is **not** from `Flashcards.zip`. It comes from another user-supplied
archive and follows the same rules as sections 13–16: originals are preserved
byte-for-byte, derived artifacts are labelled, and nothing is claimed as verified
that was not exercised. The user described the file as coming from a "Triple X
movie CD"; that is user context, **not** a verified source, and no download URL,
publisher page or disc release is claimed here.

| Property | Value |
| --- | --- |
| File | `/home/mrzetti/downloads/xxx.exe` (user-supplied) |
| Size | 1,150,564 bytes |
| Modified | 2026-09-14 22:39:46 +0200 (20:39 UTC) |
| SHA-256 | `5e948382d5934c2caafb2e72c4b14bb03f0bf37f5181e677f1e11699c8e62d73` |
| Repo originals | `originals/2002-xxx-soundtrack-sfx.exe`, `originals/2002-xxx-soundtrack.exe`, `originals/2002-xxx-soundtrack.swf` |

### 17.1 Wrapper and projector

The supplied file is a 32-bit Windows (PE32, i386, four sections) self-extracting
ZIP: an SFX stub carrying UPX 0.72 markers ("UPX 0.72 Copyright (C) 1996-1999
Laszlo Molnar & Markus Oberhumer") and Gilles Vollant `unzip 0.15` strings, with
a conventional ZIP central directory at the end. It contains exactly one entry.

| Entry | Method | Compressed | Uncompressed | CRC-32 | SHA-256 | ZIP timestamp |
| --- | --- | ---: | ---: | --- | --- | --- |
| `xXx.exe` | deflate | 1,117,013 | 1,426,637 | `0x98d8ff40` | `467ab67569cb2b3c6efdf3ee160aac39ce3abe6d7494653b37e840ea7cc37f9f` | 2002-09-06 14:18:40 |

`xXx.exe` is a 32-bit Windows Flash projector (PE32, i386, five sections, linker
timestamp 2000-08-18 02:00:29 UTC) whose stub strings include `Shockwave Flash`,
`ShockwaveFlash`, `FSCommand:`, `application/x-shockwave-flash` and `.swf`. The
stub ends exactly at byte offset 376,832 and an uncompressed `FWS` movie follows
(the same projector-stub size as the `2001-ich-will` and `2002-mutter`
projectors in section 3). Eight trailing bytes follow the declared movie end:
`56 34 12 fa c5 04 10 00` — the little-endian marker `0xfa123456` followed by
the movie's declared length `0x001004C5`. They are part of the projector, not
the movie, and were not copied into the preserved SWF.

| File | Bytes | SHA-256 | How obtained |
| --- | ---: | --- | --- |
| `originals/2002-xxx-soundtrack-sfx.exe` | 1,150,564 | `5e948382d5934c2caafb2e72c4b14bb03f0bf37f5181e677f1e11699c8e62d73` | the supplied wrapper, byte-for-byte |
| `originals/2002-xxx-soundtrack.exe` | 1,426,637 | `467ab67569cb2b3c6efdf3ee160aac39ce3abe6d7494653b37e840ea7cc37f9f` | the ZIP's single entry `xXx.exe`, byte-for-byte |
| `originals/2002-xxx-soundtrack.swf` | 1,049,797 | `08fce3212e4a36b43dafa8ef1503acefd9dffe1f44538f3602200e24714eb69a` | the movie at inner offset 376,832, sliced to its declared length |

### 17.2 The movie

| Property | Value |
| --- | --- |
| Signature / version | `FWS` v5 (AVM1, Flash 5) |
| Stage | 450 × 200 px |
| Frame rate | 18 fps |
| Timeline | 658 frames |
| Protect tag | present but empty (no password); a separate `EnableDebugger` tag carries a hashed value |
| Imports / video / metadata | no `ImportAssets`, `DefineVideoStream` or `Metadata` tags |
| Trailer | frames 1–481: MPAA green card, Columbia, Revolution Studios, xXx footage, "MUSIC INSPIRED BY", "IN CINEMAS ACROSS EUROPE: 17.10.02" |
| Menu | frame 482 jumps to 483 (logo sequence with the `meinSound` loop); the timeline stops at frame 501, labelled `xxx` |
| Other labels | `4lyn` (506), `ntrack1`–`ntrack14` (510–523), `dates` (531), `links` (541), `send2` (551), `exit` (561) |
| Projector commands | `fscommand("fullscreen","true")` and `allowscale("false")` at frames 1, 501 and 517; `fscommand("quit")` at frame 658 |

The 43 text fields exported by FFDec 26.2.1 include "xXx - THE SOUNDTRACK",
"MUSIC FROM AND INSPIRED BY THE MOTION PICTURE", "IN CINEMAS ACROSS EUROPE:
17.10.02", "DISC 1" and "DISC 2 | \"THE XANDER XONE\"" with the full track
lists. Disc 1 track 01 is `RAMMSTEIN | FEUER FREI (3:10)`; Disc 1 continues to
`I.M.E. | JUICY (4:09)` and Disc 2 to `JOI | LICK (6:29)`. The panels carry
`4LYN | "NEON"` and `in stores: 09.09.2002`, the 4LYN tour dates from
07.09.2002 to 12.10.2002, `SEND THIS FLASH-CARD 2 YOUR FRIEND !!` with UR
MAIL / FRIENDS MAIL / SEND, `STATUS` / `DATA TRANSFER COMLETE !!`, `Online
Verbindung erforderlich!` and the closing `produced by webGROOVE
_trend_media_productions` credit. The movie is German/European in flavour; its
own artwork prints `xXx` / `XXX`, and the German release title "Triple X" comes
from the supplied context and the `/e-card/triplex/` path used by its track
URLs. The 2002 dates in the movie (17.10.02, 09.09.2002 and the September–October
2002 tour list) support the card's `year: 2002`; the ZIP entry's 2002-09-06
timestamp is container metadata and is not used as proof.

The interactive controls are laid out **outside** the 450 × 200 stage (Ruffle
still hit-tests them when the player element is taller than the stage; see
VERIFICATION.md):

| Control | Root placement (stage px) |
| --- | ---: |
| `xxx` menu button (frame 496, → 501) | (-143.7, 284.1) |
| 4LYN button (→ 506) | (-48.6, 284.1) |
| DATES button (→ 531) | (46.7, 284.1) |
| LINKS button (→ 541) | (150.7, 284.1) |
| SEND2FRIEND button (→ 551) | (249.7, 284.1) |
| exit button (→ 561) | (596.4, -58.6) |
| sound ON/OFF sprite `bsound` (buttons 339/341) | (-98.0, -83.4) |
| 14 track rows (inside the 4LYN sprite) | x ≈ 509 |
| SKIP TRAILER button (frame 1, → 366) | hit area x 361.5–411.5, y 192.5–210.5 (partly below the stage) |

### 17.3 Audio

| Sound | Where used | Format | Duration |
| --- | --- | --- | ---: |
| `meinSound` (DefineSound chid 1, exported; `start(0,999)`) | root frame 483, loops through the logo, menu and panels | MP3, 32 kbps, 22,050 Hz mono | 5.382 s |
| timeline stream (SoundStreamHead + 576 SoundStreamBlock tags) | frame 1 onward, under the trailer | MP3, 32 kbps, 22,050 Hz mono | 31.798 s |
| button sound (chid 318) | attached to the UI buttons | MP3, 32 kbps, 22,050 Hz mono | 0.910 s |

All three decode to real signal (ffmpeg `volumedetect`: mean −15.6 / −15.4 /
−28.3 dB). The trailer stream and the looping `meinSound` cue are audible in the
browser check (VERIFICATION.md). No track was identified or recovered.

### 17.4 Embedded URLs (content references, not provenance)

| Key | References |
| --- | --- |
| track previews | `http://www.4lyn.de/e-card/triplex/track1.swf` … `track14.swf`, one per track frame, loaded with `loadMovieNum(...,10,"GET")` |
| form | `http://www.motor.de/_scripts/mailform_xxx.php` (the SEND2FRIEND `getURL`) |
| links | `http://www.amazon.de/exec/obidos/ASIN/B00006H1GH/...`, `http://www.universal-music.de`, `http://www.sonypictures.com/movies/triplex/`, `http://www.sonypictures.com`, `http://www.revolutionstudios.com/home.html`, `http://www.4lyn.de`, `http://www.motor.de`, `http://www.webgroove.de` |
| popup | `javascript:Mitte2('images/album2.jpg',400,400)` |

### 17.5 Missing dependencies and layout

| Dependency | Status |
| --- | --- |
| 14 `trackN.swf` track previews | **Dead**: on 2026-09-15 every URL redirected from `http` to `https` and returned **404**. The Internet Archive was temporarily offline during the check (availability API HTTP 429; the site served a "Temporarily Offline" page), so no capture was retrieved and no recovery is claimed. |
| `images/album2.jpg` (album popup companion) | **Absent** from the projector. |
| `motor.de/_scripts/mailform_xxx.php` | Historical form endpoint; not contacted. |
| The card's own sound ON/OFF control | Present in the movie but placed at stage (-98, -83), outside the stage; not reachable in Ruffle. |
| The 14 track-row buttons | Present in the 4LYN screen but placed at stage x ≈ 509, outside the stage; not reachable in Ruffle. The browser therefore never requests the track previews. |

The movie is the e-card's only container; no decompiled export, companion
folder or README was supplied with it. `originals/2002-xxx-soundtrack.swf` is
the unmodified movie; the projector and SFX wrapper are preserved only as
originals and are downloads, not browser plugins.

### 17.6 Verification

Browser verification in the project's Ruffle 0.6.0/Chromium covers the trailer
with audio, SKIP TRAILER, both disc tracklists, the DATES / LINKS / SEND2FRIEND
panels, wrapper mute, restart, close/reopen, fullscreen and the 390 × 844
layout, plus the dead track URLs checked over HTTP. The exact observations and
their limits are recorded in [VERIFICATION.md](VERIFICATION.md); the original
Windows projector was not executed.

### 17.7 Reproduction

Tools: Python 3 (stdlib `zipfile`, `struct`, `hashlib`), ffmpeg 6.1, JPEXS
FFDec 26.2.1 and a Chromium browser for the Ruffle checks.

1. Hash the supplied wrapper and confirm `5e9483…e62d73`.
2. `zipfile.ZipFile(...).read('xXx.exe')`; confirm `467ab6…7cc37f9f`.
3. Find `FWS` at offset 376,832, read the little-endian length at offset +4 and
   slice exactly that many bytes; confirm `08fce3…14eb69a` and the header
   (`FWS` v5, 450 × 200, 18 fps, 658 frames).
4. Save the three files and append their SHA-256 sums to
   [`originals/SHA256SUMS`](originals/SHA256SUMS).
5. `java -jar ffdec.jar -export script,text,frame,sound,image,shape,
   morphshape,button,sprite,movie <outdir> originals/2002-xxx-soundtrack.swf`
   and `-swf2xml` for the tag-level structure used in this section.
6. Derive the thumbnail (section 6) and run `python3 qa/validate_catalog.py`.

No Windows executable was run at any point and no SWF byte was modified.
