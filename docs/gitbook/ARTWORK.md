# Documentation artwork

The Home cover was generated with the built-in image generation tool, then copied unchanged to `home/assets/nabungfi-cover.png`. The application's car, house and laptop posters were style/object references. This is illustrative artwork rather than a screenshot, user balance or measured progress state.

## Cover prompt

> Create an original premium editorial cover illustration for NabungFi documentation, wide landscape 16:9. The three references are STYLE AND OBJECT REFERENCES from the actual application: preserve their pale lime, warm ivory, graphite, glass pale blue and tiny coral plastic brick materials and recognizable shapes. Compose one cohesive warm paper studio scene: a small block-built car in left foreground, a half-built small house toward upper right, an open brick-built laptop lower right, with a few carefully arranged loose square and rectangular toy construction blocks forming a visual path of small steps between them. Show three stages of building without percentages or labels. Objects look like beautifully crafted simple toy models, small upward studs, soft rounded plastic edges, clear clean construction, soft natural shadows, gentle three-quarter view, plenty of breathing space, warm off-white #f8f7ef background. A few tiny loose blue #2d87d8, yellow #ffd94e and red #e9473d bricks echo the approved NabungFi flat block identity. Calm, inviting, restrained, tactile. Keep the whole arrangement comfortably inside the image, no cropped objects, no people, no currency symbols, no coins, no numbers, no text, no logos, no watermarks, no artificial glossy finance charts. This is an illustrative cover, not a UI screenshot.

References: `apps/web/public/models/car.jpg`, `house.jpg` and `laptop.jpg`.

## Introduction overview illustration

`documentation/assets/nabungfi-product-overview.png` is an original 16:9 illustration generated with the built-in ChatGPT image generation tool on 9 October 2026. It is embedded immediately after the Introduction / Overview title and description. It shows a chosen car goal, a partial build beside separate savings vaults, and a completed build after verification. It is a conceptual product overview, not an application screenshot, user balance or measured savings outcome. The three captions are "Choose your goal", "Save USDC" and "Complete your build". The original generated file is preserved; the repository contains an unchanged copy.

### Overview prompt

> Use case: infographic-diagram.
> Create a polished original wide 16:9 overview illustration for the Introduction page of NabungFi, a goal-based USDC savings app. It must work as an explanatory hero image directly below a documentation page title. This is a conceptual illustration, not a UI screenshot.
> Style: elegant tactile 3D toy construction blocks, soft studio lighting, warm ivory #f8f7ef background, pale lime and white car pieces, dark charcoal tires, pale blue glass, occasional blue #2d87d8, yellow #ffd94e and coral-red #e9473d accent bricks. Rounded plastic edges and small upward studs, restrained realistic shadows. A modern premium editorial composition, no sketch lines.
> Composition: three balanced stages arranged left to right, with two simple small charcoal arrows connecting them. Keep all objects within generous margins. Three short, large, crisp dark sans-serif captions centered under each stage, spelled EXACTLY: "Choose your goal", "Save USDC", "Complete your build". These are the only large captions.
> LEFT: a pale ivory upright goal card bearing a simple car silhouette and a small blue flag, with a few unassembled car bricks neatly beside it. No fake balances or percentages.
> CENTER: a clearly half-built small pale-lime toy car, with roof and several upper body pieces missing; blue and yellow loose bricks nearby. Behind it, two small distinct safes with circular dials represent separate network-local savings vaults. Each safe has a tiny blue token marked "USDC". Small secondary caption only: "Funds stay on each chain". Do not show money crossing between safes.
> RIGHT: the recognizable fully assembled version of the SAME pale-lime toy car, white studded roof, black tires with white hubs, pale blue windows, coral rear detail, resting on a subtle ivory display base. A small clean blue checkmark beside it. Small secondary caption only: "Verify, then claim".
> Make the car's unbuilt, partial and completed states unmistakably different. The car represents a savings goal, not an actual automobile purchase. Text must be correctly spelled and high contrast; no dense paragraphs, percentages, chart grids, return or APY claims, logos, watermarks, extra labels or people. Keep the entire scene clear and refined so it reads at documentation-column width.

## Editable diagrams

`documentation/assets/journey-v2.excalidraw` and `architecture-v2.excalidraw` are native Excalidraw version-2 scenes containing editable icons, text, shapes and arrows. They use Excalifont, hand-drawn outlines and the NabungFi blue/yellow/red accents. Their SVG and PNG files were actually rendered through `@excalidraw/utils` 0.1.5 in an isolated local browser, with the handwritten font embedded. Labels use ASCII-safe text to prevent the mojibake found in the superseded diagrams.

The published articles embed the PNG exports. No per-image download strip is added to the articles. The original scenes remain in the repository for future edits.

## Brand assets

The public header uses the application's canonical N icon. Light/dark wordmark SVG exports also retain that same mark and outlined Outfit 600 lettering. They require no external font request and are available if the site plan supports a custom header logo. These exports do not replace the application's approved branding.
