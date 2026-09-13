# Rammstein Flashcards

A browser home for a collection of original Rammstein Flashcards: promotional
microsites, animations, and small interactive games, presented in a Windows
XP–inspired desktop.

**Play:** https://flashcards.rammwiki.mrzetti.com  
**Source:** https://github.com/mrzetti/flashcards

The original SWFs are preserved alongside a self-hosted **Ruffle 0.6.0** runtime.
The launcher is an independent static site. Select a card in the collection and
launch it explicitly; the desktop provides window management and playback
controls. See the card's instructions and compatibility notes before playing.

## Using the desktop

- Click a tile to inspect it, or its green play button to launch it.
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
`assets/` or `originals/` so deployment includes them. Each card includes its `title`,
`swf`, `thumbnail`, native `width`/`height`, description, instructions, controls,
status, and notes. Include a `year` only when supported by evidence.

1. Keep the original movie byte-for-byte and record its SHA-256 and provenance.
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
