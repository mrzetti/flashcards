#!/bin/sh
set -eu
cd "$(dirname "$0")"
DEST=${1:-/var/www/flashcards}
for file in index.html styles.css app.js player.html player.js screensaver.html screensaver.js catalog.json; do
    test -f "$file" || { echo "Missing required public file: $file" >&2; exit 1; }
done
test -d assets/ruffle || { echo "Missing self-hosted runtime" >&2; exit 1; }
python3 qa/validate_catalog.py
install -d "$DEST"
for file in index.html styles.css app.js player.html player.js screensaver.html screensaver.js catalog.json; do
    install -m 0644 "$file" "$DEST/$file"
done
rsync -a --delete assets/ "$DEST/assets/"
if [ -d originals ]; then rsync -a --delete originals/ "$DEST/originals/"; fi
for file in README.md HOSTING.md PROVENANCE.md VERIFICATION.md THIRD_PARTY.md LICENSE; do
    if [ -f "$file" ]; then install -m 0644 "$file" "$DEST/$file"; fi
done
find "$DEST" -type d -exec chmod 755 {} +
find "$DEST" -type f -exec chmod 644 {} +
