# patches/ — Benzin runtime compatibility

These files support the Benzin (`2005-benzin-game`) real-runtime investigation.
The metadata-focus fix is **already incorporated in `player.js`**. The diff is
retained as the record of the fix; do not reapply it. It changes no preserved asset.

## `player.js-defer-metadata-focus.patch`

Wrapper fix for `player.js`, applied by the coordinator after the comparison run.

**Problem.** `player.js` calls `focusRuffle()` synchronously inside the Ruffle
`loadedmetadata` event (`onMetadata()`). With the bundled Ruffle 0.6.0 this
leaves keyboard input dead for the rest of the session: real Arrow key events
reach the page (`document.activeElement` is `ruffle-player`, the shadow
`#container`), but the movie never sees them, so Benzin's `Key.isDown(37/38/39/40)`
clip actions never fire. Mouse clicks still work; the touch-control buttons
(which dispatch synthetic key events and then focus) still work.

**Fix.** Escape the metadata callback:

```diff
       postState();
-      focusRuffle();
+      window.setTimeout(focusRuffle, 0);
```

This keeps the "focus the player after load" behaviour, but runs it after
Ruffle's event dispatch completes. The stage `pointerdown` handler and the
`focus` host message continue to focus the player on user interaction.

**Evidence.** `qa/benzin-config-bisect.cjs` isolates the variable: with the
exact `player.js` load options but **no** metadata focus, Arrow keys drive the
truck; adding only `p.focus()` inside `loadedmetadata` stops all movement;
`setTimeout(focus, 0)` (or 50 ms, or focus on first click, or blur after a
moment) restores it. `qa/benzin-fix-verify.cjs` runs the same session twice
against a served copy of `player.js`:

| session | real Arrow keys | result |
| --- | --- | --- |
| control (unmodified `player.js`) | ArrowUp/ArrowLeft held | truck does not move, score stays blank |
| fixed (`setTimeout(focusRuffle, 0)`) | ArrowUp/ArrowLeft held | truck drives, score 498+ (nonzero) |

Screenshots: `/tmp/opencode/benzin-fix/{control,fixed}-0[1-4]-*.png`.

## Touch forwarding (later fix, direct in `player.js`)

After the metadata-focus fix deployed, the on-screen buttons stopped driving the
truck: the touch handler dispatched synthetic keys *before* moving focus into
the player, and Ruffle 0.6 ignores synthetic keys while the player is unfocused.
The touch-related fix lives directly in `player.js` (owned by this workstream;
not part of the patch above): `sendKey()` now focuses the player before
dispatching a press, and keyboard activation of a touch button holds until its
window `keyup`. See `qa/BENZIN-VERIFICATION.md` for the matrix and the
mouse/two-finger/keyboard-button verification.

## Why there is no SWF patch

The failure is entirely wrapper-side. The original
`originals/2005-benzin-game.swf` runs and drives correctly under Ruffle 0.6 in
a plain top-level harness and in the fixed player page; no content change is
required, and the preserved file stays byte-for-byte untouched.
