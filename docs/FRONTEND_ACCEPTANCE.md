# Frontend testnet acceptance — 2 October 2026

The authenticated web/PWA implementation is committed with the multichain workshop. Its first code release is `8d6af65`. It prepares owner wallet actions against the existing authenticated API, supports independent concurrent goals, and keeps visual assembly separate from financial authority. Source implementation is not proof of a browser-signed financial lifecycle or production readiness.

## Implemented experience

- Goals, per-goal detail/history, verified wallets, settings and mobile bottom navigation.
- Original 100-component car, laptop, house and sculpture models with shared geometry/materials, assembly audio, keyboard rotation, mute and reduced-motion controls.
- Fractional next-piece progress, exact micro-USDC amounts, independent targets and permanent completed builds after claims.
- Vault setup, exact approval, separate deposit confirmation, preparation and local claims. Approval completion reopens a review of the original goal/chain/amount; it never automatically signs a deposit.
- Original request/hash recovery, independently checked transaction contents, session/app binding, stale-read action blocking and a synchronous double-click guard. Expired unsigned plans can be refreshed explicitly; submitted/uncertain requests cannot use that path.
- Public PWA shell, manifest/icons, opt-in installation, offline action blocking and explicit updates. Returning-account hints load Privy eagerly but confer no authentication. Guest visits load the SDK only when an account is opened.
- Vercel build settings and public configuration validation. Server secrets, wallet keys and database configuration are excluded from frontend variables.

## Observed verification

| Check | Result and boundary |
| --- | --- |
| Frontend typecheck/production build | Passed; the deferred Three.js workshop bundle still exceeds the build size warning |
| Frontend unit checks | 36 passed, including request recovery, transaction semantics, amount boundaries, model counts, PWA exclusions and Vercel configuration |
| Browser component checks | 10 passed in installed Microsoft Edge; fixtures make no API calls or wallet transactions |
| Automated accessibility | No WCAG A/AA violations in the tested overview and creation dialog; not a complete manual accessibility certification |
| Keyboard | Escape closes the creation dialog and restores the trigger's focus |
| Production guest reflow | No horizontal overflow at 320, 390, 768, 1280 and 1440px; no uncaught page errors in this run |
| Production workshop | Assembly replay, rotation and settings navigation exercised in isolated Chrome |
| Account entry | Open workshop loaded the SDK and displayed the real Privy sign-in modal in the production in-app browser; no account identifier, OTP, token or financial action was entered |
| PWA/API boundary | Real proxied `/api/goals` returned 401 without authentication; no API entries in public Cache Storage; offline navigation preserved the shell and disabled sign-in |

Lighthouse ran through the Node API attached to an isolated, installed Google Chrome browser, against the production preview. The desktop run used Lighthouse's actual desktop configuration; an earlier invocation using only a CLI-style preset flag was not a valid desktop measurement and is excluded. Three fresh runs per configuration yielded:

| Configuration | Performance | Accessibility | Best practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Mobile, median | 73 | 100 | 100 | 100 |
| Desktop, median | 99 | 100 | 100 | 100 |

These are local guest-route measurements, not deployed Vercel, authenticated-wallet or physical mobile-device results. Mobile performance is an open gate. The real 3D experience and animation remain intact; they were not removed to improve scores. Private screenshots and raw audit reports are retained locally and are not committed.

## Remaining release gates

1. Genuine Privy browser authentication against this final client, followed by owner-confirmed setup/deposit/complete/claim with original receipts reconciled through the API. Earlier CLI finance and separately verified Privy login remain separate evidence classes.
2. Further mobile render/bundle optimization and a fresh performance check. Existing static warnings also identify large components; no clean audit or all-100 performance claim is made.
3. Actual Vercel publication, exact allowed frontend origins in Privy and API CORS, and HTTPS acceptance on the deployed URL.
4. Physical mobile/PWA installation, wallet return/deep-link behavior and testing with prospective users.

This release uses cash USDC on testnets. Yield is inactive. No mainnet deposit, new keeper deployment, production financial claim or independent security audit is established by these frontend checks.

## Logo integration — 2 October 2026

The selected flat six-course N uses a fixed irregular blue/yellow/green arrangement. Four equal 2:1 rectangles connect left course five to right course two along equal 12px overlaps. Master artwork has upward studs on all uncovered tops; small-use and monochrome derivatives omit them. A canonical SVG generates those variants, favicon and PWA icons; the header uses the small-use mark. The wordmark is a unified dark Outfit “NabungFi”. The [brand reference](../apps/web/BRAND.md) documents geometry, colors and generation. Public static asset contents contribute to the service-worker version so icon-only changes update correctly.

Production guest checks at 320/390/768/1280px inspect reflow, loading and offline availability. The maskable PNG foreground is checked against its 204.8px central safe circle. The final grid uses 24×24 squares, four identical 48×24 rectangles and 6×3 studs on uncovered tops; small-use and single-color marks omit studs. The local review displays full-color and one-color versions at 24px and 32px. Automated checks do not establish human recognition of the mark, another wallet transaction, physical mobile installation or a new Lighthouse result.


## Shared design and route pass — 2 October 2026

The accepted six-row N remains unchanged. The current public interface contract is `apps/web/DESIGN.md`, with one `src/tokens.css`, a custom block icon family and original-render goal posters. The user explicitly scoped the UI rules away from 3D artwork. Original car/laptop/house/sculpture geometry, 100-piece counts, lime/cream materials and lighting remain intact. Flat replacement illustrations and model recoloring were removed before release. Legacy local-demo controls use the same primitives.

`/` is marketing; `/app` is the authenticated task shell. Returning-account hints do not replace the landing page. PWA launches use `/app?source=pwa`. Existing app hashes and the explicit local-demo URL remain supported. Auth and 3D runtime code are deferred; the landing’s interactive model loads after the visitor requests it. Activity, Wallets and Settings use the same presentational components in the real app and the isolated fixture harness.

Observed checks for this pass:

- Frozen offline dependency installation and production build passed. The unused third-party icon dependency was removed without changing pinned wallet/chain dependency resolutions.
- 36 unit checks passed. 17 isolated browser checks passed, including landing/app navigation, mobile logo visibility, model choice, native FAQ disclosure, task-page reflow, motion preference, history navigation and the previous financial component checks.
- 32 page/width combinations: system showcase, landing, guest app, goal overview/detail, Activity, Wallets and Settings at 320/390/768/1280px. No horizontal overflow or uncaught page errors. These are visual fixtures, not proof of live account balances.
- Automated WCAG A/AA checks found no violations on landing, sign-in gate, system showcase, goal overview/creation dialog and Activity/Wallets/Settings. Escape restored the creation trigger’s focus. Human screen-reader and participant testing remain separate.
- The production landing assembly preview was exercised, including its deferred 3D renderer. Offline `/app` reloaded its shell with sign-in disabled, and Cache Storage contained no API entries.

Lighthouse used the Node API attached to isolated installed Google Chrome, with three runs per route/preset. Median scores during this pass:

| Route/preset | Performance | Accessibility | Best practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Landing mobile | 97 | 100 | 100 | 100 |
| Landing desktop | 100 | 100 | 100 | 100 |
| Guest app mobile | 97 | 100 | 100 | 100 |
| Guest app desktop | 100 | 100 | 100 | 100 |

Mobile performance is below the frontend skill’s 100-point aspiration. This is not a full perfection-gate certification. The deferred Three.js chunk remains about 1MB before gzip. React Doctor scored 74 with eight warnings in existing financial/controller/workshop paths (loading cleanup, complexity and response parsing); no finding was suppressed and this branding pass does not certify that audit as clear. Live account UX, browser-signed transactions, physical-device installation, participant recognition of the block icons and Vercel publication remain independent release gates.

Private reproducible artifacts: `.local/design-qa/checks.json`, page screenshots, `.local/design-qa/performance.json`, Lighthouse JSON reports and browser/unit logs. They are excluded from Git. No VPS service, contract, goal balance or wallet transaction was mutated by this pass.


## Animated landing and dedicated app pages — 2 October 2026

`/` now has scoped GSAP hero, canonical-mark assembly, chain-progress diagram, process-step, FAQ and closing animations. It keeps native scrolling and a pause control. Text remains fully opaque throughout motion; decorative SVG pieces may fade. Reduced motion renders the complete readable state. The original 3D model geometry/materials are unchanged; an explicitly requested model intro starts silently without overwriting the account's saved sound preference.

`/app/goals`, `/app/activity`, `/app/wallets` and `/app/settings` now use dedicated URL paths. The unified parser supports existing hash links and per-goal selection, while browser Back/Forward and reload retain the destination. Root marketing anchors never open the app. The landing auth-hint boundary and app financial authority remain unchanged. The root no longer eagerly imports app-shell CSS.

Verification: production build passed; 41 unit checks and 21 isolated browser checks passed. The added checks cover route compatibility, encoded goal identity, app navigation/history, scroll motion, pause/resume, device reduced motion and silent preview with sound preference preservation. Browser accessibility checks passed during active motion after removing transient text fades that reduced contrast. Mobile motion offsets were reduced to fit the page gutters. The 3D poster now has a definite image frame, preventing overlap with its caption.

Production Chrome reflow was checked at 320/390/768/1280px with motion enabled and reduced, before and after scrolling. No horizontal overflow or uncaught page errors occurred in the final run. Native scrolling and the original assembly were recorded in a local WebM; neither this video nor screenshots contain a connected account or financial transaction.

Three Lighthouse runs per route/preset on isolated installed Chrome measured these medians:

| Route/preset | Performance | Accessibility | Best practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Animated landing mobile | 96 | 100 | 100 | 100 |
| Animated landing desktop | 100 | 100 | 100 | 100 |
| Guest app mobile | 98 | 100 | 100 | 100 |
| Guest app desktop | 100 | 100 | 100 | 100 |

These local startup scores do not establish all animation frame rates, physical-device usability, signed browser settlement or deployed Vercel performance. The 100-in-every-category perfection target remains unmet on mobile. Existing React Doctor/controller debt and live release gates remain as recorded above. Private artifacts are under `.local/animated-landing-qa/`; no public deployment, API mutation, contract transaction or VPS change occurred.


## 360-degree model control and red identity — 3 October 2026

The landing now exposes `Explore 360°` separately from assembly. Exploration opens the completed original model even if an earlier marketing replay was interrupted. The actual account workshop retains its verified funded-piece cap and per-goal build persistence. The shared workshop supports unrestricted horizontal drag, arrow steps, reset and an explicit 3.2s full-turn control with Stop. Drag, arrow input and reset interrupt the automated turn. Reset retains the responsive fitted zoom and each model’s target instead of restoring a desktop zoom on mobile. Reduced motion keeps manual controls and disables the automated sweep; vertical touch scrolling remains available.

Identity green was replaced with red `#E9473D` while blue and yellow were retained. The canonical mark's geometry/studs remain identical; small-use, favicon and PWA assets were regenerated from that master. Block icons and marketing identity accents follow the same palette. Original 3D materials, external chain PNGs and semantic success greens remain separate. The header mark uses a palette query to avoid serving an older green mark from an existing PWA cache while an update waits.

Production build and 41 unit checks passed. The final isolated browser suite passed 24 checks, including actual view changes during a full turn, stop by drag/arrows/reset, all three landing models at 320px, reduced motion and stale-preview recovery. Earlier request/receipt/amount/goal-isolation checks remain included. XML comparison confirmed that only mark fill values changed. Private screenshots/video and frame checks are under `.local/goal-orbit-qa/`. These controls make no API call or financial mutation, and Vercel publication remains a separate step.

## Procedural toy-construction refinement — 4 October 2026

The user requested additional 3D refinement while retaining the original model themes and lime/cream art direction. Studs now form a symmetric, uniform grid across both brick axes; smaller square bricks and laptop border plates no longer lose their studs. Rounded stud lips and thickness-aware body bevels preserve a readable toy silhouette. Rubber tires have rounded shoulders and instanced tread, hubs have a small center cap, and plastic uses restrained clear-coat reflections from a locally generated Three.js studio environment. No remote HDR, texture or third-party model was added.

Car front/rear fascia close the earlier exposed gaps. House back/side corners meet and two roof-owned gable panels close the open ends. The laptop's border studs stay clear of keyboard/trackpad surfaces and its screen frame owns an opaque back plate. The custom sculpture builds as five supported terraces. Each model still has exactly 100 primary component IDs; studs, tread, caps and attached panels are details within those components. The savings progress and wallet/API paths were not changed.

Production build and 46 unit checks passed, including stud footprint/pitch/symmetry, bevel thickness, supported construction and house corners. The 24-test isolated browser suite passed during this refinement; the seven orbit/marketing-motion tests were repeated after the final model geometry changes and passed. Four models were rendered and inspected at front, side and back angles. A 390px, 50-piece workshop remained partial with no horizontal overflow or uncaught page errors. All four poster JPEGs were regenerated from the actual renderer. The final production preview precached all four revisioned poster URLs and displayed car/laptop/house posters after an offline reload, without API entries in Cache Storage or uncaught page errors.

Private visual and offline evidence is under `.local/brick-detail-qa/`. These are local procedural rendering, control and cache checks, not physical-device frame-rate measurements, signed financial execution or Vercel publication. The existing release gates above remain separate.

## Landing and app interface refinement — 4 October 2026

The accepted blue/yellow/red block identity and dimensional goal models remain. Shared controls now have restrained inset highlights, clear surface hierarchy and reduced-motion-safe press feedback. The landing uses a larger studio preview, block model-selector icons, original network PNGs, refined type/spacing, native FAQ chevrons and a blue closing action. Preview actions keep a stable stacked layout as fonts/images load; its eager hero image has high fetch priority. Noncritical model thumbnails use native lazy loading.

The app has a 248px sidebar, compact workspace context and a four-destination mobile dock with safe-area spacing. Its portfolio summary consumes the existing exact balance/availability labels without adding financial aggregation. Goal cards show a larger model, exact amounts, text/icon status and a 20×5 decorative block grid with the original funded-component count. A single New goal action replaces the duplicate add-card tile. Settings use a continuous grouped surface; detail rows use original network PNGs. No API authorization, unsigned transaction contents, balances, receipt reconciliation, goal locks or claim predicates changed.

Production build, 46 unit checks and the 24-test isolated browser suite passed. Seven motion/orbit checks were repeated after the final image/motion-layout changes and passed. The visual matrix covers landing, primitives, goals, detail, wallets and settings at 1440px, with landing/goals/detail/settings at 390px; no horizontal overflow or uncaught page errors were observed. Existing browser checks additionally cover goal/detail reflow at 320/768/1280px, native dialogs, keyboard focus, unavailable reads and automated WCAG A/AA. Fixtures are explicitly labelled examples and do not establish authenticated financial execution.

Lighthouse used the Node API attached to isolated installed Chrome, with three fresh runs per route and preset. Final local production medians:

| Route/preset | Performance | Accessibility | Best practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Landing mobile | 96 | 100 | 100 | 100 |
| Landing desktop | 100 | 100 | 100 | 100 |
| Guest app mobile | 97 | 100 | 100 | 100 |
| Guest app desktop | 100 | 100 | 100 | 100 |

The first refinement audit had landing desktop performance 99 and a 0.063 CLS; stabilizing preview controls restored 100. Mobile FCP/LCP remain optimization debt; no all-100 perfection or deployed-Vercel performance claim is made. React Scan Lite was injected before production React initialization in an isolated context: both guest routes recorded two startup commits, no commit/page errors and no unchanged-input fibers in this bounded startup check. This is not a full authenticated-runtime or 3D frame-rate profile.

React Doctor produced a report with one observer-cleanup error and eleven warnings in existing motion/controller/large-component paths; the CLI wrapper also returned nonzero. Its cleanup finding remains unsuppressed. Source ownership was made explicit and a real-browser probe measured active resize subscriptions 1 → 0 → 1 → 0 across pause/resume/pause, confirming that this effect disconnects instead of accumulating observers. Broader static maintainability/response-parsing findings remain review debt; this pass does not certify the static audit as clean.

Private artifacts are under `.local/premium-ui-qa/`, including screenshots, Lighthouse reports, `render-scan.json` and `motion-cleanup.json`. [Solana goal storage](SOLANA_GOAL_STORAGE.md) separately records the inspected shared-program/PDA model and current RPC rent reserve; no backend or onchain rent-reclaim code was changed. Genuine wallet execution, physical mobile/PWA acceptance and Vercel publication remain separate release gates.

## Blind guest comprehension check — 4 October 2026

Two fresh UI-only subagents were used sequentially, with no conversation history or product brief and no repository/memory/source/fixture access. The first independently understood the savings concept but returned PARTIAL after finding a blocked publicly linked legacy demo and inconsistent old earning/two-chain copy. Those failures were preserved before repair. Public demo links now open the working silent 3D preview without authentication or financial API calls; the old ledger is development-only. Release context, assembly/claim separation, pending completion, motion control and install guidance were clarified.

The fresh second visitor returned PASS for guest comprehension/navigation and independently described testnet USDC, multichain goals, 100 visual milestones, isolated target locks, chain-local vaults, inactive yield and separate claims. It exercised guest previews and app navigation, plus opening/dismissing sign-in without credentials. Three minor findings remained; subsequent neutral loading copy and an above-fold no-wallet preview action repaired two. The instant visual acknowledgement for reduced-motion replay remains a minor note; accessible completion feedback was observed.

Production build, 46 unit checks and the 26-test browser suite passed after the main repairs. The two guest regression tests were rerun after the last loading/hero-link changes and passed, including no API requests from the guest preview and visible release/guest-action context at 1280×720. The [blind review](BLIND_USABILITY_REVIEW.md) preserves the separate original and fresh outcomes. This supports synthetic guest understanding, not completed authenticated financial workflows or validation with human participants.

## Authentication before workspace — 4 October 2026

At the user's request, public app actions now lead to a separate `/login` screen rather than a guest workspace shell. Axis Robotics' live `/login` reference was viewed in a new isolated headless Chrome profile, with no connection to the user's browser/cookies. Its equal visual/form split, compact login panel and Privy attribution informed the layout. NabungFi keeps its own N mark, palette, fonts and procedural car poster; no Axis assets/social-provider list were copied.

Email/code actions call the installed Privy SDK's `useLoginWithEmail` methods, with the documented CAPTCHA component mounted only outside the Privy modal. Wallet authentication uses Privy's configured wallet UI. Only email/wallet methods are rendered. The workspace is withheld until SDK readiness/authentication and a backend session match the current Privy subject, app ID and testnet profile. Direct app links preserve an encoded internal destination through login; invalid/external targets fall back to `/app/goals`. Account switching cannot expose another identity's session. A localStorage hint never grants workspace access. Existing wallet-plan, receipt and claim authority is unchanged.

Production build, 48 unit checks and 29 browser checks passed. New tests cover wrong/missing identities, unready/unauthenticated states, invalid return URLs, original goal identity, email/code/resend errors, and withholding navigation until a matching simulated backend session is available. Login forms reflowed at 320/390/768/1280px and passed automated WCAG A/AA checks. The fixture uses explicitly synthetic codes/session states and makes no real authentication or financial request.

An isolated production Chrome run exercised Open app → `/login`, initialized the real Privy SDK, opened its actual wallet picker (MetaMask/Coinbase/Rainbow/Other wallets), and preserved `/app/goals?goal=car-example` as the login return target. No workspace navigation appeared while signed out, mobile had no horizontal overflow, and no uncaught page errors were observed. No email/OTP was submitted, no wallet connected and no financial action occurred; a genuine completed login/backend redirect remains a human acceptance step. Reference and verification screenshots are private under `.local/axis-login-reference/` and `.local/login-qa/`.

The earlier blind test's guest access to workspace navigation/settings is intentionally superseded by this user-requested authentication boundary. The public build preview remains available without sign-in and without application API traffic; startup may read Privy's public configuration before leaving the login route.

## Vercel publication — 5 October 2026

The pushed frontend source `10f75f78b934e86f1a8b270b42877f3f39ef3b50` was built by Vercel and published at **https://nabungfi.vercel.app**. Twenty-one live HTTP checks passed, including public SPA entries, PWA files, immutable JavaScript, exact VPS API CORS and unauthenticated 401 responses. The live browser initialized Privy, opened its real wallet picker, preserved an original goal deep link through sign-in and loaded the public 100-piece preview. Landing/login reflow checks found no horizontal overflow at 320/390/768/1440px. No email/OTP, wallet connection or financial transaction was submitted.

This establishes frontend publication and unauthenticated integration availability. A genuine completed sign-in/backend redirect, browser-owned financial lifecycle and physical-device PWA installation remain pending acceptance. The separate API/keeper stayed active; only the API restarted to add the exact Vercel origin. Publication used a tracked-files-only source archive through CLI. GitHub auto-deployment is not connected because the Vercel account lacks repository write/admin access. See the [release record and operating instructions](../apps/web/DEPLOYMENT.md).
