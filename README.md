# Rammstein Flashcards

A browser home for a collection of original Rammstein Flashcards: promotional
microsites, animations, and small interactive games, presented in a dark
RammWiki-branded desktop. Alongside the Flash cards it preserves the 1999
**RAMMSTEIN Screensaver**, an archived Director 6/Windows artifact whose 103
sprites ship with a browser preview and downloads, the 2001 **Mutter Enhanced
CD** data session, whose Universal Media Player shell, Sonne music video and
artwork ship with a browser preview, and embeds **Asche zu Asche**, the
preserved 1997 browser game hosted in its own project.

**Play:** https://flashcards.rammwiki.mrzetti.com  
**Source:** https://github.com/mrzetti/flashcards

The original SWFs are preserved alongside a self-hosted **Ruffle 0.6.0** runtime.
The launcher is an independent static site. Select a card in the collection and
launch it explicitly; the desktop provides window management and playback
controls. See the card's instructions and compatibility notes before playing.

## Using the desktop

- Click a tile to inspect it, or its play button to launch it.
- Use the title-bar buttons to minimize, maximize/restore or close. Drag the
  title bar to move a window; use the taskbar to bring it back.
- Only one Flashcard plays at a time. Opening another replaces the player;
  minimizing pauses it and closing releases its iframe and audio resources.
- Volume, mute, restart and fullscreen are in the player toolbar. If the browser
  blocks audio initially, use Ruffle's **Click to unmute** overlay.
- Share the browser URL after selecting a card. For example,
  [`?card=2001-ich-will`](https://flashcards.rammwiki.mrzetti.com/?card=2001-ich-will)
  selects Ich will and waits for the visitor to choose Launch.
- On mobile, windows fill the desktop. Benzin gets its own accelerate, brake,
  left and right touch buttons; pointer-driven cards do not get a generic keypad.
- **Archived artifacts** (like the 1999 screensaver) do not run in Ruffle. Their
  play button opens one files-and-preview window: a sprite animation rebuilt
  from the extracted original bitmaps, the download list, and a gallery of the
  extracted images. The original Windows executable and the Director movie are
  downloads, not browser plugins.
- **Browser games** (like Asche zu Asche) run on their own site inside one
  desktop window. The emulator is click-to-load there, closing the window
  releases it, and the game page keeps a full-page link for browsers without the
  required cross-origin isolation. Losing all lives shows a wrapper overlay that
  restarts the game automatically after a short countdown.

**Playable** means the documented local interaction was verified. **Partial**
means something important is absent or unconfirmed, commonly a remote video or
historical form service. Read the details and verification notes for the exact
scope; the badges are not promises that every original online feature works.

## Run locally

```sh
git clone https://github.com/mrzetti/flashcards.git
cd flashcards
python3 -m http.server 8080
```

Open http://localhost:8080. Serve over HTTP rather than opening `index.html` as a
local file, since the catalog, iframe, SWFs, and WebAssembly are loaded through
browser requests. No frontend build or external CDN is required.

## Preservation and compatibility

- [PROVENANCE.md](PROVENANCE.md): supplied archive, original hashes, dependency
  inspection, sources, and modifications.
- [VERIFICATION.md](VERIFICATION.md): actual browser verification and remaining
  compatibility limitations.
- [THIRD_PARTY.md](THIRD_PARTY.md): runtime licenses and original content rights.
- [HOSTING.md](HOSTING.md): fresh-VPS nginx/HTTPS setup and update instructions.

Historical links and server-side features may no longer work. A movie rendering
successfully is not proof that every historical feature works; verification
notes distinguish these cases. Original embedded content is assessed separately
from the English launcher UI.

## Adding cards

The collection is described by `catalog.json`, with a top-level `cards` array.
Use a stable ASCII `id` and relative asset URLs. Store public card files under
`assets/` or `originals/` so deployment includes them. Flash cards include their
`swf`, `thumbnail`, native `width`/`height`, description, instructions, controls,
status, and notes. Include a `year` only when supported by evidence.

Artifact cards (`"kind": "artifact"`) omit `swf` and instead carry an optional
`preview` page plus `downloads` (`label`/`url`/`meta`) and `gallery`
(`url`/`caption`) lists. Their files are validated against the deployed trees by
`qa/validate_catalog.py`; preview pages live at the project root, like
`player.html`.

Browser-game cards (`"kind": "embed"`) carry an https `url` to the game's own
click-to-load page and use the desktop's single embed window instead of Ruffle.
The host must allow framing: this site sends COOP `same-origin` and COEP
`require-corp` for cross-origin isolation, and the game host sends COOP/COEP
plus a same-site `Cross-Origin-Resource-Policy`. Nothing downloads until the
game page's own Load game button is used.

1. Keep the original movie or archive byte-for-byte and record its SHA-256 and
   provenance.
2. Inspect decompiled scripts and runtime network requests for companion files.
   Preserve the required relative layout. Keep compatibility patches separate.
3. Add a thumbnail derived from the card (with its origin documented), then add
   the catalog entry using existing entries as examples.
4. Test the actual interaction, audio, restart, close/reopen, keyboard focus,
   fullscreen, and mobile layout. Only add touch keys needed by that card.
5. Update provenance and verification documentation, then deploy.

Do not substitute archive/export timestamps for verified original release dates.
Do not label historical email forms or remote scores as working without checking
their backend. The site does not implement a collection-wide leaderboard.
