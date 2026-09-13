"""Verify HTTPS deployment matches the local catalog and runtime assets."""
import hashlib
import json
import sys
from pathlib import Path
from urllib.parse import quote, urljoin
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
base = (sys.argv[1] if len(sys.argv) > 1 else
        "https://flashcards.rammwiki.mrzetti.com/").rstrip("/") + "/"


def fetch(relative, expected_type=None):
    with urlopen(urljoin(base, quote(relative, safe="/")), timeout=60) as response:
        assert response.status == 200, relative
        if expected_type:
            assert response.headers.get_content_type() == expected_type, (
                relative, response.headers.get_content_type())
        data = response.read()
    expected = (ROOT / relative).read_bytes()
    assert hashlib.sha256(data).digest() == hashlib.sha256(expected).digest(), relative
    print(f"OK {relative}")
    return data


fetch("index.html", "text/html")
catalog = json.loads(fetch("catalog.json", "application/json"))
for card in catalog["cards"]:
    fetch(card["swf"])
    fetch(card["thumbnail"])
fetch("assets/ruffle/ruffle.js", "application/javascript")
for wasm in (ROOT / "assets/ruffle").glob("*.wasm"):
    fetch(wasm.relative_to(ROOT).as_posix(), "application/wasm")
print("Deployment content and MIME checks passed.")
