"""Check the portable catalog and binary assets before publication."""
import json
import hashlib
import re
import struct
import zlib
from pathlib import Path
from urllib.parse import unquote, urlsplit, parse_qs

ROOT = Path(__file__).resolve().parents[1]


def local_file(value):
    url = urlsplit(value)
    assert not url.scheme and not url.netloc, f"Non-relative asset: {value}"
    assert not url.path.startswith("/"), f"Root-relative asset: {value}"
    assert url.path.startswith(("assets/", "originals/")), f"Asset outside deployed trees: {value}"
    path = (ROOT / unquote(url.path)).resolve()
    assert path.is_relative_to(ROOT), f"Asset escapes project: {value}"
    assert path.is_file(), f"Missing asset: {value}"
    return path


def local_page(value):
    """A page served from the project root (player.html, screensaver.html...)."""
    url = urlsplit(value)
    assert not url.scheme and not url.netloc, f"Non-relative page: {value}"
    assert not url.path.startswith("/"), f"Root-relative page: {value}"
    assert url.path.endswith(".html"), f"Not an HTML page: {value}"
    path = (ROOT / unquote(url.path)).resolve()
    assert path.is_relative_to(ROOT), f"Page escapes project: {value}"
    assert path.is_file(), f"Missing page: {value}"
    return path


def main():
    preserved = 0
    for manifest, base in ((ROOT / "originals/SHA256SUMS", ROOT / "originals"),
                           (ROOT / "assets/cards/SHA256SUMS", ROOT)):
        for line in manifest.read_text().splitlines():
            if not line.strip() or line.startswith("#"):
                continue
            expected, filename = line.split(maxsplit=1)
            original = (base / filename.lstrip("*")).resolve()
            assert original.is_relative_to(ROOT), f"Hash path escapes project: {filename}"
            actual = hashlib.sha256(original.read_bytes()).hexdigest()
            assert actual == expected, f"Preserved-file checksum mismatch: {filename}"
            preserved += 1
    print(f"Verified {preserved} preserved original/extracted asset hashes.")
    companion = (ROOT / "patches/keine-lust/player_txt.txt").read_bytes()
    assert (ROOT / "originals/player_txt.txt").read_bytes() == companion, "Deployed companion differs from documented reconstruction"
    fields = parse_qs(companion.decode().strip())
    assert fields == {"numTracks": ["1"], "trackTitle1": ["01: KEINE LUST"]}, "Invalid Keine Lust LoadVars data"
    cards = json.loads((ROOT / "catalog.json").read_text())["cards"]
    assert cards, "Empty collection"
    ids = set()
    for card in cards:
        ident = card["id"]
        assert re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", ident), ident
        assert ident not in ids, f"Duplicate ID: {ident}"
        ids.add(ident)
        assert card["title"] and card["instructions"], ident
        assert card["width"] > 0 and card["height"] > 0, ident
        kind = card.get("kind", "flash")
        assert kind in ("flash", "artifact", "embed"), f"{ident}: unknown kind {kind!r}"
        if kind == "artifact":
            local_file(card["thumbnail"])
            if card.get("preview"):
                local_page(card["preview"])
            assert card.get("downloads"), f"{ident}: artifact needs downloads"
            for entry in card["downloads"]:
                assert entry["label"], f"{ident}: download without label"
                local_file(entry["url"])
            for entry in card.get("gallery", []):
                local_file(entry["url"])
            print(f"OK {ident}: artifact with {len(card['downloads'])} downloads, "
                  f"{len(card.get('gallery', []))} gallery images")
            continue
        if kind == "embed":
            local_file(card["thumbnail"])
            assert not card.get("swf"), f"{ident}: embed must not list a SWF"
            url = urlsplit(card.get("url", ""))
            assert url.scheme == "https" and url.netloc, f"{ident}: embed needs an https url"
            print(f"OK {ident}: browser game embed at {url.netloc}{url.path}")
            continue
        data = local_file(card["swf"]).read_bytes()
        assert data[:3] in (b"FWS", b"CWS", b"ZWS"), f"Invalid SWF: {ident}"
        expected = struct.unpack_from("<I", data, 4)[0]
        if data[:3] == b"CWS":
            assert len(zlib.decompress(data[8:])) + 8 == expected, ident
        elif data[:3] == b"FWS":
            assert len(data) == expected, ident
        local_file(card["thumbnail"])
        print(f"OK {ident}: Flash {data[3]}, {len(data):,} bytes")
    runtime = json.loads((ROOT / "assets/ruffle/package.json").read_text())
    assert runtime["version"] == "0.6.0"
    for license_name in ("LICENSE_MIT", "LICENSE_APACHE"):
        assert (ROOT / "assets/ruffle" / license_name).is_file()
    print(f"Validated {len(cards)} cards and Ruffle runtime/licenses.")


if __name__ == "__main__":
    main()
