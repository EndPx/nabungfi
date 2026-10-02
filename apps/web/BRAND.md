# NabungFi visual identity

The mark is a flat multicolor N built from square and rectangular blocks. It follows the selected five-course construction; it is not a photorealistic toy render.

## Canonical mark

`public/brand/nabungfi-mark.svg` owns the geometry. Each column has five courses, numbered from the bottom. Left course four extends inward; right course two extends inward; a third-level rectangle connects both spans. Small studs attach only to exposed upper edges, with no floating caps, holes or highlights.

The header uses this SVG with a single Outfit 600 **NabungFi** wordmark. Keep the spelling and capitalization together. Do not style “Fi” as a separate gray suffix. The main frame is 36px, with 28px frames in compact navigation. The intrinsic SVG padding provides space around the shape; preserve it when sizing the mark.

All parts follow one design unit: squares are 24×24; each connecting rectangle is 48×24 (2:1). Rows advance 24px and connectors advance 36px horizontally, giving equal 12px overlaps. Studs are 6×3 with 12px center spacing on the same grid. Covered studs are omitted. Scaling the complete SVG preserves these ratios.

| Identity color | Hex |
| --- | --- |
| Blue | `#2D87D8` |
| Red | `#E9473D` |
| Yellow | `#FFD94E` |
| Green | `#47AE69` |
| Orange | `#F49B3A` |

The warm canvas (`#F8F7F2`), paper (`#FFFEFA`), dark ink (`#22251E`) and existing lime actions remain the interface palette. Work Sans handles body text and controls; Outfit handles headings and the wordmark. Logo colors do not replace the semantic warning/error/success states or their text and icons.

## Favicon and PWA

Run `python apps/web/scripts/make-icons.py` from the repository root with Pillow installed. The script reads the canonical rectangle geometry and emits the favicon and 192px/512px/maskable PNGs; it does not maintain a second drawing of the N. Maskable foreground artwork is inset inside the central safe circle. All icon backgrounds use the warm canvas.

The build includes the canonical mark in the public PWA cache. Static asset contents contribute to the service worker version, so a logo-only or icon-only change still requests an explicit app update. Financial requests and private responses remain outside that cache.

Local exploration images are not release assets. Landing/app routing, browser-wallet financial acceptance and public deployment retain their own release gates.
