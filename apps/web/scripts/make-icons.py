"""Rasterize the original NabungFi block monogram. Requires Pillow only."""
from pathlib import Path
from PIL import Image, ImageDraw

output = Path(__file__).resolve().parent.parent / "public" / "icons"
output.mkdir(parents=True, exist_ok=True)
for name, size, inset in [("icon-192.png", 192, 0), ("icon-512.png", 512, 0), ("maskable-512.png", 512, 20)]:
    scale = size / 100
    image = Image.new("RGB", (size, size), "#d4ec79")
    draw = ImageDraw.Draw(image)
    def polygon(points):
        adjusted = [(int((x * (1 - inset / 100) + inset / 2) * scale), int((y * (1 - inset / 100) + inset / 2) * scale)) for x, y in points]
        draw.polygon(adjusted, fill="#22251e")
    polygon([(23, 72), (23, 35), (34, 35), (66, 72), (77, 72), (77, 35), (66, 35), (66, 54), (39, 23), (23, 23)])
    polygon([(23, 13), (39, 13), (39, 21), (23, 21)])
    polygon([(61, 13), (77, 13), (77, 28), (61, 28)])
    image.save(output / name, optimize=True)
