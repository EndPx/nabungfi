# Blind guest usability review

Date: 4 October 2026. Initial reviewed commit: `f2d1995`.

The user requested a fresh subagent that learns NabungFi from the interface rather than a product explanation. The tester was spawned with no conversation history and no product brief. It was restricted to rendered UI and visible navigation; repository, memory, source, external descriptions, credentials, wallet connection and financial transactions were excluded. Screenshots remain private under `.local/blind-usability/`.

## Frozen first impression

Before interacting, the tester independently described a goal-based savings app for a car, laptop or home, with progress represented by a brick model taking shape. It cited the headline, “one block at a time,” Start a goal and the car preview. Confidence was high for the savings purpose and medium for the relationship between savings and blocks. Asset, networks, testnet status and withdrawal conditions were not discovered in the first desktop viewport.

## Original result: PARTIAL

After scrolling and using FAQs, the tester correctly described USDC savings, four test networks, multiple isolated goals, one piece per 1% with fractional contributions, chain-local vaults, progress messaging, indefinite target locks and inactive yield. Preview model selection, assembly and rotation worked. Open app and Start a goal reached a clear sign-in boundary. Authenticated creation, deposit, completion and claim were not tested.

| Severity | Direct observation | Consequence |
| --- | --- | --- |
| P1 | Explore the demo opened a local-demo badge with Let's reconnect / Sign in to continue; retry repeated it. | The advertised guest demo was blocked. |
| P2 | Demo About described Solana/Base, net earnings and lending, while landing described four test networks and inactive yield. | Conflicting versions of the product were publicly reachable. |
| P2 | Finish the build / Rakit language did not clearly separate visual assembly from financial unlocking. | A visitor could infer that playing the animation was required for withdrawal. |
| P2 | Completion verification was described without a clear waiting/status explanation. | Withdrawal readiness and delayed-chain behavior were unclear. |
| P2 | Demo's home control returned to its blocked workshop, requiring browser Back to recover. | The demo lacked a clear escape path. |
| P3 | USDC/testnet and preview controls appeared below the first viewport. | Important release context was discovered late. |
| P3 | Settings offered installation messaging without an available action or fallback explanation. | A guest did not know how to proceed. |
| P3 | Motion control was visually an unexplained brick icon. | Its accessible label was clear, but visual meaning was weaker. |

The tester's overall judgment was partial, despite strong product comprehension after exploration. That original outcome is preserved; repairs and any fresh review must be recorded separately. A synthetic guest walkthrough is bounded evidence of communication/navigation, not human usability validation, signed financial execution or contract enforcement.

## Repairs and a fresh independent visit

The blocked public ledger route was replaced with the existing silent 3D build preview, with no API or wallet operations. The historical ledger remains a development-only utility. Public navigation now calls the action Try a build. The USDC/testnet label moved before the hero headline, motion acquired a visible desktop label, installation guidance explains the unavailable-window case, and FAQs clarify that assembly does not affect financial eligibility and describe pending completion/per-vault claims.

A second agent was then spawned with no conversation history, product brief or previous findings. It was again restricted to rendered UI and visible links, and excluded from memory, source, docs, fixtures, credentials and financial actions. Its frozen first impression independently identified testnet USDC, multichain goal-based savings and block-model progress directly from the first viewport.

**Fresh-visit verdict: PASS for guest comprehension and visible navigation.** The tester described four test networks, 100-piece/1%-per-piece progress, isolated goals, chain-local vaults, progress messages, indefinite target locks, inactive yield and per-chain claims. It found model selection, motion controls, assembly, rotation, FAQ anchors, app navigation and the public no-wallet preview working. It opened/dismissed the sign-in modal without entering anything. No severe guest dead end or unexpected financial action was found.

The remaining observations were low severity: instant reduced-motion replay lacked an obvious visual acknowledgement despite an accessible completion announcement; generic Opening your workshop loading copy implied a different destination; and the no-wallet preview invitation was below the first fold. After this frozen report, the last two were repaired with neutral Opening NabungFi copy and a hero Try the build / No wallet needed action. Regression checks verify that the guest action and release label are within the first 1280×720 viewport. The reduced-motion visual acknowledgement is retained as a minor refinement rather than counted as a financial failure.

Private retest evidence: `.local/blind-usability-retest/fresh-visit-report.md` and `fresh-visit-*.jpg`. Do not merge this observed pass with claims of successful login, goal creation, deposits, completion, claims, physical mobile installation or real human usability; those were not exercised by either visitor.

Subsequent user-requested change: Open app now enters a standalone Privy login page, and workspace navigation/settings are available after verified authentication. The guest navigation observations above remain historical evidence for the reviewed version; they are not a blind review of the later authentication-first flow. Public no-wallet model preview remains available.
