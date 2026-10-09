# Documentation artwork

The Home cover was generated with the built-in image generation tool, then copied unchanged to `home/assets/nabungfi-cover.png`. The application's car, house and laptop posters were style/object references. This is illustrative artwork rather than a screenshot, user balance or measured progress state.

## Cover prompt

> Create an original premium editorial cover illustration for NabungFi documentation, wide landscape 16:9. The three references are STYLE AND OBJECT REFERENCES from the actual application: preserve their pale lime, warm ivory, graphite, glass pale blue and tiny coral plastic brick materials and recognizable shapes. Compose one cohesive warm paper studio scene: a small block-built car in left foreground, a half-built small house toward upper right, an open brick-built laptop lower right, with a few carefully arranged loose square and rectangular toy construction blocks forming a visual path of small steps between them. Show three stages of building without percentages or labels. Objects look like beautifully crafted simple toy models, small upward studs, soft rounded plastic edges, clear clean construction, soft natural shadows, gentle three-quarter view, plenty of breathing space, warm off-white #f8f7ef background. A few tiny loose blue #2d87d8, yellow #ffd94e and red #e9473d bricks echo the approved NabungFi flat block identity. Calm, inviting, restrained, tactile. Keep the whole arrangement comfortably inside the image, no cropped objects, no people, no currency symbols, no coins, no numbers, no text, no logos, no watermarks, no artificial glossy finance charts. This is an illustrative cover, not a UI screenshot.

References: `apps/web/public/models/car.jpg`, `house.jpg` and `laptop.jpg`.

## Editable diagrams

`documentation/assets/journey-v2.excalidraw` and `architecture-v2.excalidraw` are native Excalidraw version-2 scenes containing editable icons, text, shapes and arrows. They use Excalifont, hand-drawn outlines and the NabungFi blue/yellow/red accents. Their SVG and PNG files were actually rendered through `@excalidraw/utils` 0.1.5 in an isolated local browser, with the handwritten font embedded. Labels use ASCII-safe text to prevent the mojibake found in the superseded diagrams.

The published articles embed the PNG exports. No per-image download strip is added to the articles. The original scenes remain in the repository for future edits.

## Brand assets

The public header uses the application's canonical N icon. Light/dark wordmark SVG exports also retain that same mark and outlined Outfit 600 lettering. They require no external font request and are available if the site plan supports a custom header logo. These exports do not replace the application's approved branding.
