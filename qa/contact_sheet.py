"""Make a labeled visual-review sheet from browser captures (requires Pillow)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

source = Path(sys.argv[1])
paths = sorted(source.glob("*.png"))
paths = [path for path in paths if path.name != "contact-sheet.png"]
assert paths, "No PNG screenshots found"
width, height, columns = 420, 300, 3
sheet = Image.new("RGB", (columns * width, ((len(paths) + columns - 1) // columns) * height), "#e9e5d4")
draw = ImageDraw.Draw(sheet)
for index, path in enumerate(paths):
    x, y = index % columns * width, index // columns * height
    with Image.open(path) as image:
        thumbnail = ImageOps.contain(image.convert("RGB"), (width - 12, height - 30))
        sheet.paste(thumbnail, (x + 6, y + 24))
    draw.text((x + 6, y + 5), path.stem, fill="black")
out = source / "contact-sheet.png"
sheet.save(out)
print(out)
