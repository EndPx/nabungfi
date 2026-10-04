# NabungFi interface system

This is the current shared contract for the landing page, savings application, local demo and component showcase. Logo geometry and exports are specified in [BRAND.md](BRAND.md). CSS values live in `src/tokens.css`; screen styles consume those tokens.

## High-end UI refinement — 4 October 2026

The visual direction is a crafted savings workshop: confident Outfit typography, warm paper, precise financial labels and a dimensional construction object. Blue/yellow/red remain the identity; color is spent on actions, navigation and small block details. Depth belongs to the hero object, raised controls and focused overlays, rather than identical shadows on every section. The memorable interaction remains assembling a savings goal, not a new decorative cursor or chart.

Landing priority: headline and model first, chain context second, choose/save/unlock explanation third, commitment and questions before the final app action. A larger continuous studio stage replaces nested preview frames. The native model selector, 360 controls, pause/reduced motion and silent opt-in assembly remain. The app uses an operational summary, readable goal cards, distinct locked/unavailable/completed states and compact persistent navigation. Sidebar marketing copy is removed; app goals/actions retain their original identity, exact USDC values and wallet authority.

Research and constraints: existing NabungFi tokens/logo/3D artwork are authoritative. UI UX Pro Max's `savings fintech premium playful` result suggested Liquid Glass with luxury black/gold and Cormorant/Montserrat; reject that aesthetic as a mismatch, retain its legibility, focus, reduced-motion and restrained timing guidance. Its focus-not-obscured guidance informs scroll offsets for sticky navigation. The installed frontend router's `soft-skill.md`, `redesign-skill.md` and `stripe.md` files are unavailable; use the installed `frontend-design`/`premium-frontend-ui` guidance and actual project screenshots. This is a refinement of an existing system, not a new branding exercise. StyleGallery's [fixed-sidenav-shell](https://github.com/changeroa/StyleGallery/blob/main/patterns/viewport-shell/fixed-sidenav-shell.md) and [card-grid](https://github.com/changeroa/StyleGallery/blob/main/patterns/grid-repetition/card-grid.md) inform persistent navigation and intrinsic card sizing. The document remains the scroll owner, with no nested scrolling pane. beui.dev's actual button/base source informs pointer feedback, hover-capability and reduced-motion handling; adapt the mechanism to existing CSS/GSAP without adding Motion or scroll replacement.

New shared tokens: `--red-soft: #FCEBE7`, `--line-strong: #C8CBBF`, `--ink-hover: #343A2F`, `--surface-shadow: 0 1px 2px rgba(34,37,30,.04), 0 16px 48px rgba(34,37,30,.06)`, `--control-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 2px 0 rgba(34,37,30,.08)`, `--overlay-shadow: 0 24px 80px rgba(34,37,30,.16)`, `--radius-hero: 32px`, `--text-hero-large: 80px`, `--space-20: 80px`, `--sidebar-width: 248px`. Button variants retain 48px height, clear focus, busy/disabled states and restrained 160ms feedback. Surface borders, inset highlights and soft shadows have separate jobs. No new financial or network state is created for appearance.

Reusable extensions: `PortfolioSummary` presents already-computed balance/availability labels, without summing or unlocking goals. `GoalCard` keeps one semantic navigation button, a renderer-captured model, phase, exact saved/target amounts and 100 decorative progress cells. The cells form a 20×5 block grid, retaining one cell per funded percent. Model selector buttons use block icons with their existing text labels. Desktop navigation is stable; mobile navigation is a labelled four-destination dock with 44px+ targets and safe-area spacing. All new surfaces must pass the existing primitive showcase and keyboard/mobile checks before product-screen review.

Audience checks: a first visitor can understand the commitment before sign-in; a returning saver can choose a goal and review the next wallet action; a keyboard/reduced-motion user receives the same content and controls; an unavailable balance stays unavailable. Test fixtures show explicit example balances and never establish financial proof. Current release debt still includes physical-device/PWA and genuine browser-signed acceptance; this UI refinement does not treat synthetic scores as production deployment evidence.

## Direction and users

A simple block-building workshop for grown-up savings goals. The accepted flat, three-color N is the identity; original dimensional models are the experience. Quiet warm surfaces give exact amounts and lock rules room to breathe. Avoid glossy toy logos, trading-terminal density, decorative motion, invented balances and yield promises.

The visitor needs to understand the commitment before opening the app. The saver needs to manage several independent goals, choose a chain and review a wallet action. Keyboard and reduced-motion users need the same information and actions. Reviewers need clear separation between examples and deployed testnet state.

The user explicitly scoped these rules to the application interface. The 3D goal objects retain their own lime/cream palette, recognizable model themes and dimensional assembly. Never reinterpret them as flat logo-style illustrations or recolor them to match the UI palette. Rendering refinements follow the shared construction recipe below.

3D refinement authorized 4 October 2026: keep the established model themes and lime/cream palette, while improving toy construction. Studs use a shared 0.24-unit pitch, 0.075 radius and rounded lip, distributed across both brick axes with a safe edge margin. Small square bricks receive a centered stud. Shared instanced studs and tire tread keep draw calls bounded. Body bevels follow part thickness, ABS plastic has a restrained clear coat, rubber stays matte and transparent windows keep depth readability. A locally generated studio environment supplies reflections without remote assets. House corner joints close and two roof-owned gable panels fill the open ends; the car's front/rear fascia close exposed gaps. Laptop studs stay on uncovered border plates, with an opaque back plate on the display frame. The custom 100-piece sculpture becomes five supported terraces instead of suspended steps. Preserve 100 stable primary component IDs per model, financial progress and bottom-up construction. Studs, tread, wheel caps, gables and the display back plate belong to existing components, not extra savings steps. This refinement supersedes literal preservation of rendering details, not the model/UI palette separation.

Existing NabungFi typography, original models and the user-approved six-row logo are authoritative. UI UX Pro Max's playful-savings search suggested clay surfaces and orange; retain its accessibility guidance but reject those visual changes because they conflict with the accepted identity. Layout follows the existing document-scroll `fixed-sidenav-shell` and `main-with-rail` patterns: https://github.com/changeroa/StyleGallery. No third-party visual fidelity claim is made.

## Palette

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Canvas | `--canvas` | `#F8F7F2` | Page background |
| Paper | `--paper` | `#FFFEFA` | Cards, forms, dialogs |
| Studio | `--studio` | `#EFEEE6` | Model backdrop, disabled controls |
| Ink | `--ink` | `#22251E` | Headings, amounts, primary text |
| Muted | `--muted` | `#62655C` | Supporting text |
| Line | `--line` | `#DFDFD4` | Dividers and panels |
| Blue | `--brand-blue` | `#2D87D8` | Identity and model accents |
| Yellow | `--brand-yellow` | `#FFD94E` | Build/open/create actions with ink text |
| Red | `--brand-red` | `#E9473D` | Identity and block-icon accents |
| Blue tint | `--blue-soft` | `#E7F0FB` | Active navigation, blue model backdrop |
| Green tint | `--green-soft` | `#EAF3E7` | Goal progression and house backdrop |
| Yellow tint | `--yellow-soft` | `#FFF4CC` | Build previews and commitment surfaces |
| Strong blue | `--blue-ink` | `#215A92` | Links, active navigation and focus |
| Strong green | `--green-ink` | `#316344` | Readable progress/success text |

Action hover is `#F3CD3F`. Focus uses strong blue. Warning `#775822` on `#FFF1D4`, error `#A13831` on `#FBECE8`, success strong green on green tint; scrim `rgba(30,34,27,.36)`.

Semantic warning and error colors stay separate from identity colors, always paired with a label or icon. Never place small white text on the bright logo colors. Compatibility aliases `--lime`, `--lime-hover`, `--lime-dark` map to the current yellow action and strong-green progress roles; new screen styles use role tokens directly. Original 3D material colors are illustration values, not UI semantics. Original model material tints: lime `#C4DC6B`, light lime `#DCEB9E`, deep lime `#9BB748`, cream `#F6F0DC`, rubber `#292D28`, chassis `#41483B`, glass `#80ABB0`, rim `#E0DFD4`, lamp `#FFF1B6`, trim `#748064`; lit neutral materials preserve dimensional model readability.

## Typography and spacing

Outfit 500/600 for headings, amounts and one-piece NabungFi wordmark. Work Sans 400/500/600 for body, fields and controls. Both are self-hosted. Amounts use tabular figures. Type scale: 12 caption, 14 supporting text, 16 body/controls, 18 lead, 20 compact title, 24 section, 32 mobile title, 40 page title, 48 prominent amount, 64 desktop marketing heading. Marketing heading scales from 40 to 80; mobile caps at 64. Prose measure is at most 65ch.

Spacing follows a 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 and 96. Decorative studs and 3D geometry are proportional artwork, not spacing exceptions for interface components. Controls are at least 44px. Radii: 8 small indicator, 12 controls, 16 compact surfaces, 20 cards, 24 stage/dialog, 32 hero frame, full pill for status. Borders and tonal surfaces provide separation; restrained elevation belongs to the hero frame, raised controls, dialogs and hover feedback. Landing stages measure 400px on desktop and 320px on mobile; goal-card posters measure 224px. Progress cells use 3px gutters and a 2:1 shape as proportional block artwork.

## Layout and routes

- `/`: marketing. One headline, a clearly labelled interactive model preview, an explanation of multichain goals, the choose/save/unlock sequence and lock-rule FAQs. No account navigation or personal totals. Auth SDK loads only inside the app.
- `/app`: task UI. Goals, Activity, Wallets and Settings share `Shell`. Existing hashes preserve navigation and per-goal deep links. The guest gate explains signing in; it does not repeat the landing page.
- `/app?source=pwa`: installed entry. PWA stays on the app origin, with a versioned public shell and no cached private API responses or financial mutations.
- `/?demo=1`: explicit local ledger demonstration; it keeps its nonfinancial label and shared primitives.
- `/?showcase=1`: shared palette, typography, controls, fields and status-state review. `/?showcase=models` remains a nonfinancial original-model harness.

The document owns scrolling. Desktop sidebar is 248px. Below 900px, the app uses four labelled bottom destinations in a dock with a 12px outer inset and safe-area spacing. Landing navigation remains a compact top bar. Gutter: 16 at 320, 20 at 390, 24 at 768, 40 at 1024+. Content maximum 1280px, application maximum 1440px. Intrinsic grids use `minmax(min(...,100%),1fr)`. Long names and addresses wrap; no horizontal page scrolling. Native dialogs may own scrolling when taller than the viewport.

## Shared primitives and states

`src/icons.tsx` owns the original block icon family across all app, demo and workshop controls. Navigation identity icons use colored square/rectangular blocks and exposed studs; action glyphs keep square strokes and readable semantics. `GoalIllustration` shows posters captured from the current 3D renderer; it does not redraw the models as flat blocks. The primary component count and model palette remain consistent through refinements. Renderer-captured posters provide lightweight card thumbnails; detail and opt-in previews use the actual interactive 3D models. Regenerate all four posters after geometry or lighting changes and update their public URL revision to avoid stale PWA illustrations. External chain identifiers are contextual network marks, not recolored NabungFi artwork. The landing diagram uses locally served original PNG marks from `public/chains/`, replacing its previous letter monograms. Keep original colors and aspect ratios; adjacent chain names provide labels. These assets join the public PWA cache.

`Logo`, `Button`, `IconButton`, `Dialog`, `PageHeading`, `Shell`, `GoalIllustration`, `GoalCard`, status banners, labelled fields and transaction rows are reusable. Marketing links use the same button classes. Every destination uses the same heading hierarchy and panel treatment. The building objects retain their own visual identity. App color tokens do not recolor 3D materials or lighting.

- Buttons: default, hover, press, keyboard focus, disabled and busy; busy disables duplicate action and retains a text label.
- Fields: visible label, helper, focus, entered value, validation error. Exact six-decimal USDC input and immutable wallet review remain unchanged.
- Panels: warm paper, 1px border and card radius. Empty states point to the next valid action; unavailable reads show unavailable, never fabricated zero.
- Dialog: native focus containment, Escape, labelled title, focus restoration, narrow-screen reflow. Lock consent and explicit wallet confirmation remain required.
- Navigation: icon plus visible text, blue tint and `aria-current` for selection. Settings and install controls retain touch-sized targets.
- Status: distinct text/icon for pending, failed, offline, unavailable and achieved. An example illustration never establishes a claimable savings goal.

## Interaction and accessibility

### Animated marketing extension

Landing-only motion uses existing GSAP plus ScrollTrigger, with native document scrolling. Hero text enters as one readable sequence (0.95s, 0.06s stagger); illustrated progress messages draw toward a shared goal and its canonical N assembles from its own rectangles. The choose/save/unlock steps reveal sequentially (0.65s), and the final N assembles when its section enters the viewport. Scroll-linked diagrams use 0.65s scrub smoothing; no smooth-scroll replacement or wheel interception. UI CTA arrows move 4px on hover/focus. Native FAQ disclosure adds 0.22s content feedback without tweening height.

The visitor can pause marketing motion, and OS reduced motion renders the complete readable state with no scroll-linked transforms. No content depends on an animation completing. All timelines/triggers are scoped to the landing root and reverted on unmount or preference changes. Header reading progress is decorative, never a savings balance. Cross-chain moving marks represent progress messages; captions state that funds stay on their respective chains.

The original model geometry, lighting and material palette remain exempt from UI tokens. Selecting the interactive landing preview starts a silent build after an explicit click; it does not automatically enable sound or change the account's stored sound preference. Model previews contain no API or wallet operations. Static original-render posters provide the initial visual and the loading fallback.

The beui `scroll-animation` and `text-animation` sources inform native reduced-motion fallback and readable grouped text. Adapt those mechanisms to the existing GSAP stack; do not add Lenis/Motion or copy their components.

App URLs are `/app/goals`, `/app/activity`, `/app/wallets` and `/app/settings`. `/app` remains the goals entry; `?goal=` belongs to `/app/goals`. Browser history and legacy hash links remain supported. Account navigation never loads marketing motion.

Reuse existing 160ms transform/opacity press feedback and assembly sequence; do not add auto-playing ornament or scroll capture. Model preview and sound require an explicit user action. OS reduced motion and workshop controls remain supported. All four models retain keyboard orbit controls. The savings engine and wallet lifecycle are outside this visual change.

Use semantic landmarks, a skip link, labelled fields, visible 3px focus, native FAQ disclosures, text alternatives for meaningful artwork and 4.5:1 normal-text contrast. A static poster remains useful if WebGL fails. Model failure must never hide savings actions. Pending wallet requests must reconcile before a PWA update.

### 360-degree goal exploration

The landing poster offers `Explore 360°` to load the completed original model without starting assembly, alongside `Try a build` for the silent assembly intro. Horizontal orbit is unrestricted through a full revolution. The workshop has manual drag, 22.5-degree arrow steps, reset and an explicit `Rotate 360°` control. A full turn takes 3.2s with linear angular speed; the control switches to Stop while running. Drag, arrow input, reset, reduced-motion changes and unmount cancel the turn. Reduced motion keeps manual drag/arrows and disables the automatic sweep. Touch keeps vertical page scrolling while allowing horizontal model drag. Camera movement never changes model geometry, funded pieces, balances or claim authority.

## Evidence and limits

Verify component states before screen composition, then landing/app destinations and dialogs at 320/390/768/1280px. Exercise keyboard navigation, FAQ, model preview, offline app and deep links. Automated fixtures contain explicit example labels and make no API mutations. Record measured accessibility/performance separately from human usability or genuine wallet execution. Public Vercel deployment, participant testing and browser-signed financial acceptance are separate release gates; this design pass does not certify them.
