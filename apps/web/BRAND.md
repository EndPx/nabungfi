# NabungFi visual identity

The mark is a flat three-color N built from square and rectangular blocks. It follows the selected six-course construction.

## Canonical mark

`public/brand/nabungfi-mark.svg` owns the geometry. Each column has six courses, numbered from the bottom. Left course five extends inward; right course two extends inward; two middle rectangles at courses four and three connect both spans. All four connecting rectangles use blue, forming one continuous descending path. Only the tops of the columns retain small studs. The generated small-use and monochrome variants omit studs and preserve the exact silhouette.

The header uses `nabungfi-mark-small.svg` with a single Outfit 600 **NabungFi** wordmark. Keep the spelling and capitalization together. The main frame is 36px, with 28px frames in compact navigation and 24px at the narrowest breakpoint. Preserve the intrinsic padding. The main mark retains studs for larger artwork; the small-use variant is used at 24–32px. `nabungfi-mark-mono.svg` provides a one-color silhouette for legibility review and single-color applications.

All parts follow one design unit: squares are 24×24; each of the four connecting rectangles is 48×24 (2:1). Rows advance 24px and connectors advance 30px horizontally, giving equal 18px overlaps. The placement uses a quarter-unit grid, avoids unintended side contact with a column, and retains a connected silhouette without relying on color. Studs are 6×3 with 12px center spacing. Scaling preserves these ratios.

| Identity color | Hex |
| --- | --- |
| Blue | `#2D87D8` |
| Yellow | `#FFD94E` |
| Green | `#47AE69` |

The warm canvas (`#F8F7F2`), paper (`#FFFEFA`), dark ink (`#22251E`) and existing lime actions remain the interface palette. Work Sans handles body text and controls; Outfit handles headings and the wordmark. Logo colors do not replace the semantic warning/error/success states or their text and icons.

## Favicon and PWA

Run `python apps/web/scripts/make-icons.py` from the repository root with Pillow installed. The script reads the canonical rectangle geometry and derives the small-use and monochrome SVGs, favicon and 192px/512px/maskable PNGs. It does not maintain a second drawing. Maskable foreground artwork stays inside the central safe circle. All icon backgrounds use the warm canvas.

The build includes the canonical mark in the public PWA cache. Static asset contents contribute to the service worker version, so a logo-only or icon-only change still requests an explicit app update. Financial requests and private responses remain outside that cache.

Local exploration images are not release assets. Landing/app routing, browser-wallet financial acceptance and public deployment retain their own release gates.
