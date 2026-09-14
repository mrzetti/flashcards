#!/usr/bin/env python3
"""Summarize runtime runs and build per-card contact sheets (ffmpeg based)."""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
CARDS = [
    "2003-lichtspielhaus", "2004-reise-reise", "2005-keine-lust",
    "2005-mann-gegen-mann", "2005-rosenrot", "2006-voelkerball", "2009-lifad",
]


def summarize(card: str) -> None:
    run = OUT / card / "run.json"
    if not run.exists():
        print(f"== {card}: NO run.json")
        return
    data = json.loads(run.read_text())
    print(f"== {card}")
    print(f"   ready={data.get('ready', {}).get('ready')} url={data.get('playerUrl')}")
    meta = data.get("metadata") or {}
    print(f"   metadata={meta.get('width')}x{meta.get('height')} frames={meta.get('numFrames')} fps={meta.get('frameRate')} swfVersion={meta.get('swfVersion')}")
    print(f"   settle={data.get('settle')}")
    print(f"   semanticChanges={data.get('semanticChanges')} gridChangedCells={len(data.get('gridChangedCells') or [])}")
    print(f"   panels: title={(data.get('panelsInitial') or {}).get('title')!r} year={(data.get('panelsInitial') or {}).get('year')!r} status={(data.get('panelsInitial') or {}).get('status')!r}")
    for s in data.get("successes", []):
        print(f"   + {s}")
    for i in data.get("issues", []):
        detail = (i.get("detail") or "")
        detail = detail[:220].replace("\n", " ")
        print(f"   ! [{i.get('severity')}] {i.get('kind')}: {detail}")
    ext = data.get("externalRequests") or []
    if ext:
        print(f"   external requests ({len(ext)}):")
        for r in ext[:15]:
            print(f"      {r.get('status') or r.get('failure') or '?'} {r.get('phase')} {r['url'][:150]}")
    failed = data.get("failedRequests") or []
    if failed:
        print(f"   failed requests ({len(failed)}):")
        for r in failed[:15]:
            print(f"      {r.get('status') or r.get('failure')} {r.get('phase')} {r['url'][:150]}")
    if data.get("dialogs"):
        print(f"   dialogs: {data['dialogs']}")
    if data.get("popups"):
        print(f"   popups: {data['popups']}")
    audio = data.get("audioEvidence")
    if audio:
        print(f"   audio: {json.dumps(audio)}")
    changed = [s for s in data.get("semanticClicks", []) if s.get("clickChanged")]
    for s in changed:
        print(f"   sem#{s['step']} ({s['fx']},{s['fy']}) changed; requests={len(s.get('newRequests', []))} audioRms={s.get('audio', {}).get('maxRms')}")
    for c in (data.get("gridChangedCells") or [])[:15]:
        print(f"   grid ({c['fx']},{c['fy']}) changed; audioRms={c.get('audio', {}).get('maxRms') if c.get('audio') else None}")


def build_sheet(card: str) -> None:
    d = OUT / card
    if not d.exists():
        return
    wanted = [
        "00-loaded-stage.png", "01-cpu-warning.png", "05-settled-stage.png",
        "19-sem-01-hover.png", "20-sem-01-changed.png", "21-sem-01-settled.png",
        "20-sem-02-changed.png", "21-sem-02-settled.png",
        "20-sem-03-changed.png", "21-sem-03-settled.png",
        "20-sem-04-changed.png", "30-grid-0-0.png", "31-grid-0-0-settled.png",
        "30-grid-2-2.png", "30-grid-5-3.png", "30-grid-7-5.png",
        "39-after-interactions.png", "44-restarted-stage.png",
    ]
    images = []
    for name in wanted:
        p = d / name
        if p.exists() and p.stat().st_size > 0:
            images.append(p)
    for p in sorted(d.glob("30-grid-*.png")):
        if p not in images:
            images.append(p)
    for p in sorted(d.glob("31-grid-*-settled.png")):
        if p not in images:
            images.append(p)
    images = images[:12]
    if len(images) < 2:
        return
    sheet = d / "contact-sheet.png"
    subprocess.run(
        [sys.executable, str(HERE / "make-sheet.py"), str(sheet), *[str(p) for p in images], "--cols", "3", "--width", "420"],
        check=True,
    )
    print(f"   sheet: {sheet}")


if __name__ == "__main__":
    only = sys.argv[1:] if len(sys.argv) > 1 else CARDS
    for card in only:
        summarize(card)
        build_sheet(card)
        print()
