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
