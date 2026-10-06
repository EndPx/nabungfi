# Bank Jago reference adaptation

Reference: [Bank Jago UI Recreate (Community)](https://www.figma.com/design/ChtrvBbHrLMa7zoS9ygPQ0/Bank-Jago-UI-Recreate--Community-?node-id=1-6), inspected through the authenticated Figma plugin on 7 October 2026. The file is an unfinished community recreation, not evidence of Bank Jago's usability statistics or a specification for NabungFi's financial behavior.

## Coverage and source nodes

The file has Thumbnail (`0:1`), Moodboard (`1:2`), Wireframe (`1:3`), Design System (`1:4`), UI Design (`1:5`) and Prototyping (`1:6`). The high fidelity section (`175:8474`) contains 74 top-level screens. The full UI metadata was read and indexed by its text and hierarchy; wireframe and moodboard inventories were also read. Ten relevant screens/components were inspected with design context and their returned screenshots. The component frame (`171:11871`) and prototype section (`175:8472`) are explicitly labelled unfinished. A final prototype-link inspection hit the account's Figma MCP limit; no complete clickable prototype or exhaustive visual review of all 74 screens is claimed.

| Reference | Node | Pattern adopted |
| --- | --- | --- |
| Home | `173:14582` | Greeting, prominent balance, short contextual actions |
| Pocket list | `173:12961` | Search, filter chips, two-column savings pockets and a create tile |
| Pocket detail | `173:13169` | Name/balance before contextual actions and history |
| Amount entry | `173:12647` | Prominent amount panel, source context and explicit continuation |
| History | `173:13815` | Searchable compact rows with a secondary status line |
| Login | `173:14664` | Focused grouped inputs and one clear continuation action |
| Empty pockets | `173:14396` | Useful empty-state explanation rather than fictional records |
| Settings | `173:15591` | Section headings and grouped preference rows |
| Pocket component | `173:17587` | Reusable card hierarchy and quiet background |
| Bottom navigation | `173:17728` | Persistent icon-and-label destinations |

The remaining screens cover investments, loans, card management, transfers, bills, QR payment, charity, referrals, security, account registration and support. Their metadata informs information hierarchy, but those products are not added to NabungFi because the current backend does not provide them.

## Measured foundations and intentional adaptation

The reference screens use a 1080px design canvas for mobile. Do not copy those raw pixel sizes into a browser layout. The design-system grids document an eight-pixel spatial unit, 16px gutters, four mobile columns, eight tablet columns and a 1136px desktop content area on a 1440px screen. Adapt with fluid CSS and the existing NabungFi spacing tokens.

The reference uses TT Commons Pro Trial, with two published bold text styles and many local text values. Retain NabungFi's licensed Outfit/Work Sans pair. Actual paint styles include white, black, orange button (`#FDAF27`), purple button and an orange gradient. Some palette labels contain stale copied hex text, so paint definitions and rendered screens were used instead of the labels. NabungFi retains its yellow action and approved blue/yellow/red brand.

The recreation contains gray placeholder imagery. NabungFi uses its real renderer-captured goal posters and live model, its existing block icon family, and original chain/Google PNG marks. No Bank Jago logo, customer identity, interest promotion, regulatory claim or copied trial font is shipped.

## Acceptance boundary

Search and filters must never alter goal isolation, money totals or unlock rules. A populated component fixture is visual/interaction evidence only. Actual session verification, deployed API behavior, wallet signatures, LayerZero delivery and claims remain distinct evidence. The UI must show unavailable reads accurately and preserve target-lock consent, explicit transaction review and pending-operation update guards. PWA checks must include real service-worker behavior, not just a manifest presence check.
