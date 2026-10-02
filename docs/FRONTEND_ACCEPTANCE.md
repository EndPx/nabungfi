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

The selected flat five-course N and its small exposed-top studs now share one canonical SVG across the header, favicon and PWA icons. The wordmark is a unified dark Outfit “NabungFi”. The [brand reference](../apps/web/BRAND.md) documents geometry, colors and generation. Public static asset contents now contribute to the service-worker version so icon-only changes can update correctly.

Fresh production guest checks at 320/390/768/1280px loaded the mark without horizontal overflow or uncaught page errors. The SVG was present in public Cache Storage and remained visible after offline reload. The maskable PNG foreground remained inside its 204.8px central safe circle. The final grid uses 24×24 squares, three identical 48×24 rectangles, and 6×3 studs on a 12px pitch. Existing 36 unit checks and 10 browser component checks passed. This branding pass does not establish another wallet transaction, mobile-device installation, deployment or new Lighthouse result.
