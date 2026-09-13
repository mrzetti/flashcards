# PROVENANCE — RammWiki Flashcards

This document records where the preserved Flash cards came from, what was
extracted or derived, what was deliberately left out, and what has and has not
been verified. It distinguishes the **source of this collection** (the archive
below) from **URLs that appear inside the content** (historical captions, forms
and scripts), which are *not* provenance.

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
unchanged. No SWF, EXE or projector was patched or recompressed.

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

All thumbnails are real exports from the archive, scaled to a maximum of 480 px
and encoded as JPEG (plus one bitmap pulled from a SWF, because that card has no
decompiled export). No thumbnail is an invented or AI-generated image.

| id | Source | Note |
| --- | --- | --- |
| 2001-mutter | `Mutter/frames/1131.png` | Green cross/logo frame from the timeline. |
| 2001-ich-will | `Ich will/images/110.jpg` | Bitmap export (Till Lindemann still). |
| 2002-mutter | `assets/cards/2002-mutter/images/embedded_01.jpg`, pulled from the movie's `DefineBitsJPEG2` tags | Bitmap extracted from the movie itself (no decompiled export exists); all 13 recovered JPEGs are kept in `assets/cards/2002-mutter/images/` and their hashes are in `assets/cards/SHA256SUMS`. |
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
| 2005-rosenrot | 2005 | Embedded track listing cites live recordings from February, June and July 2005. |
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
