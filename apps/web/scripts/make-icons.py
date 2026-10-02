"""Render favicon/PWA icons from the canonical rectangular SVG. Requires Pillow."""
from pathlib import Path
from copy import deepcopy
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

public = Path(__file__).resolve().parent.parent / "public"
source = ET.parse(public / "brand" / "nabungfi-mark.svg").getroot()
view_x, view_y, view_width, view_height = map(float, source.attrib["viewBox"].split())
rectangles = list(source.iter("{http://www.w3.org/2000/svg}rect"))
ET.register_namespace("", "http://www.w3.org/2000/svg")
small = deepcopy(source)
for group in list(small):
    if group.attrib.get("id") == "exposed-studs":
        small.remove(group)
ET.ElementTree(small).write(public / "brand" / "nabungfi-mark-small.svg", encoding="utf-8", xml_declaration=False)
mono = deepcopy(small)
for rectangle in mono.iter("{http://www.w3.org/2000/svg}rect"):
    rectangle.set("fill", "currentColor")
ET.ElementTree(mono).write(public / "brand" / "nabungfi-mark-mono.svg", encoding="utf-8", xml_declaration=False)
output = public / "icons"
output.mkdir(parents=True, exist_ok=True)
background = "#f8f7f2"
supersample = 4
for name, size, fraction in [("icon-192.png", 192, .84), ("icon-512.png", 512, .84), ("maskable-512.png", 512, .64)]:
    canvas_size = size * supersample
    image = Image.new("RGB", (canvas_size, canvas_size), background)
    draw = ImageDraw.Draw(image)
    scale = canvas_size * fraction / max(view_width, view_height)
    offset_x = (canvas_size - view_width * scale) / 2
    offset_y = (canvas_size - view_height * scale) / 2
    for element in rectangles:
        x, y, width, height = (float(element.attrib[key]) for key in ("x", "y", "width", "height"))
        bounds = (offset_x + (x - view_x) * scale, offset_y + (y - view_y) * scale,
                  offset_x + (x + width - view_x) * scale, offset_y + (y + height - view_y) * scale)
        radius = float(element.attrib.get("rx", "0")) * scale
        if radius:
            draw.rounded_rectangle(bounds, radius=radius, fill=element.attrib["fill"])
        else:
            draw.rectangle(bounds, fill=element.attrib["fill"])
    image.resize((size, size), Image.Resampling.LANCZOS).save(output / name, optimize=True)

# The favicon uses the same vector contours, with a warm rounded background.
ET.register_namespace("", "http://www.w3.org/2000/svg")
small.insert(0, ET.Element("{http://www.w3.org/2000/svg}rect", {
    "x": str(view_x), "y": str(view_y), "width": str(view_width), "height": str(view_height),
    "rx": "28", "fill": background,
}))
ET.ElementTree(small).write(public / "favicon.svg", encoding="utf-8", xml_declaration=False)
