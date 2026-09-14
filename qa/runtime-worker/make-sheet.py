#!/usr/bin/env python3
"""Build a labeled contact sheet from PNGs using ffmpeg only (no Pillow).

Usage: python3 make-sheet.py OUT.png IMG1 [IMG2 ...] [--cols 3] [--width 460]
"""
import subprocess
import sys
import tempfile
from pathlib import Path

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def main() -> None:
    args = sys.argv[1:]
    cols = 3
    width = 460
    if "--cols" in args:
        i = args.index("--cols")
        cols = int(args[i + 1])
        del args[i:i + 2]
    if "--width" in args:
        i = args.index("--width")
        width = int(args[i + 1])
        del args[i:i + 2]
    out = Path(args[0])
    images = [Path(p) for p in args[1:]]
    assert images, "no images given"

    tmp = Path(tempfile.mkdtemp(prefix="fc-sheet-"))
    processed = []
    for index, image in enumerate(images):
        label = image.stem.replace("'", "")
        target = tmp / f"{index:02d}.png"
        vf = (
            f"scale={width}:-2,pad={width}:ih+24:0:24:0xE8E8E8,"
            f"drawtext=fontfile={FONT}:text='{label}':x=6:y=4:fontsize=15:fontcolor=0x111111"
        )
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(image), "-vf", vf, str(target)],
            check=True,
        )
        processed.append(target)

    # xstack layout, row by row
    inputs = []
    for p in processed:
        inputs += ["-i", str(p)]
    layout = []
    for i in range(len(processed)):
        col = i % cols
        row = i // cols
        x = "0" if col == 0 else "+".join(f"w{j}" for j in range(row * cols, i))
        y = "0" if row == 0 else "+".join(f"h{j}" for j in range(0, row * cols, cols))
        layout.append(f"{x}_{y}")
    graph = "".join(f"[{i}]" for i in range(len(processed)))
    graph += f"xstack=inputs={len(processed)}:layout={'|'.join(layout)}[out]"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[out]", str(out)],
        check=True,
    )
    print(out)


if __name__ == "__main__":
    main()
