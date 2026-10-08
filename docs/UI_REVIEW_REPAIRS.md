# Blind UI review repairs

8 October 2026. The first five context-free AI evaluators recognized independent USDC savings goals, but overall comprehension/navigation remained partial for several reviewers. Their private frozen reports are kept locally; account screenshots and identifiers are not published.

## Changes

- **Balance meaning:** Current savings counts funds still in vaults. Collected cards identify historical amounts and funded pieces. Any missing detail read withholds the complete portfolio total rather than presenting a subtotal as complete.
- **Visual meaning:** Workshop counts say assembled; the funded count and the separation from financial eligibility are explicit. Card images are identified as template previews. Overshoot is explained beside the target.
- **Availability:** Background reads leave the New goal draft accessible. Final creation preserves session, offline, busy and pending-request guards with a visible reason. Dashboard has explicit read status and Refresh balances. Detail-read retries are bounded and never retry mutations, authentication rejection or identity substitution.
- **Read load:** Simultaneous detail requests for the same authenticated owner, goal and immutable binding share one in-flight read. The result is removed after settlement; later requests read fresh state. The existing four-read admission limit remains intact.
- **Unsigned cancellation:** An authenticated, owner-wallet-checked endpoint atomically cancels only a fingerprint-matching planned step with no transaction hash. Signing/submitted/unknown outcomes are refused. Cancellation preserves the goal and confirmed vaults, does not sign or send a replacement, and has a distinct audit reason. Review closure/Escape pauses setup and cancels an unsigned step; a saved recovery also offers explicit review/cancel choices.
- **Navigation and mobile:** View history uses a persistent goal-activity anchor and focuses that section. Narrow headings reflow beside/below actions without splitting words. Optional external wallet actions distinguish session connection from account linking; existing goal ownership is unchanged.
- **Context:** Dashboard and creation use compact testnet/cash-USDC/inactive-earning context. No long test-token footnote is restored.

## Validation

- 77 frontend unit tests and 46 server tests passed.
- 70 real Neon/HTTP checks passed, including owner isolation, incorrect fingerprints, idempotent cancellation, cancellation versus wallet-start races, and refusal to cancel a pending transaction. Only disposable test identities and adapter fixtures were used; zero financial transactions.
- Eight focused browser repairs passed, including 320/390/768/1280px reflow and creation-dialog accessibility, pending-draft blocking, history focus, funded/assembled labels and unsigned-versus-attempted recovery.
- Twenty existing history/setup/pocket/PWA browser checks passed in the focused run. The first new assembly-label assertion needed the existing 30-second cold-workshop loading allowance; it then passed without changing app behavior.
- Production build, generated-worker lifecycle and actual production-shell acceptance passed. PWA checks cover offline/auth/signing guards, pending-update blocking, old-cache retirement and lazy wallet-confirmation assets.

An accidentally broad browser run reached legacy landing tests that still expect the retired headline/model selector and zero canvases. A separate existing completion-hop screenshot comparison returned identical frames on two runs; its sound and celebration-state checks reached the expected states, but visual hop evidence was not established by that test. These are not presented as a green full-suite result. The repair-specific checks above are reported separately. Physical-device and genuine signed-financial acceptance are outside this UI repair validation.

## API release

The native API release is `/opt/nabungfi/api-releases/ui-repairs-da04770c224dff77`, copied from the previous API-only template release and overlaid with three public server files. Only the API WorkingDirectory drop-in and API process changed. Health was verified; the global current release pointer and keeper PID remained unchanged. No migration, keeper deployment, key/configuration change or signed transaction was required.

Fresh live blind reviews are a separate acceptance step. Their verdicts must be preserved as given, with actual coverage and session-sharing limitations; synthetic scores cannot certify transaction execution or human usability.

## Second review correction

The first three new evaluators still found gaps: one comprehension PARTIAL and two navigation PARTIAL. Paused setup intercepted its history destination; a lazy 3D scene could shift a deep-linked history section; completion delivery lacked an obvious in-app explanation. The original frozen reports are preserved.

The follow-up gives history a dedicated view with its own loading/error/retry state, dates/outcomes, Back to activity and View goal. It does not mount a 3D scene or resume setup, and it works for incomplete goals independently of balance availability. Normal goal details keep the requested mobile order. The commitment section explains reaching the target, Prepare completion, completion delivery and per-chain claims. Collected copy now says completed goal, without assuming visual assembly is finished. Paused network setup labels its next step without implying wallet confirmation has already started.

Thirteen focused history/repair browser checks passed after this correction; frontend unit tests remained 77/77 and the production build passed. Final evaluator acceptance is recorded separately after the deployed follow-up is tested.

A subsequent targeted review caught a same-goal navigation race: View goal removed the activity fragment, but React could keep the history screen because destination and selected ID had not changed. History-view selection now has explicit reactive state, updated by both navigation and browser history events. The previous PARTIAL remains preserved; the correction requires live verification of View history → View goal on the same incomplete goal, not just a changed URL.

## Final evaluator acceptance

All five evaluators ultimately reported PASS for comprehension and PASS for the read-only navigation they inspected. Visitors 1–3 retained their original blind impressions and used focused follow-ups to verify corrections; visitors 4–5 first inspected the later release. This is iterative acceptance, not a claim that five new users all passed their first encounter with the final build.

| Visitor | Initial revision verdict: comprehension / navigation | Latest observed verdict | Follow-up scope |
|---|---|---|---|
| 1 | PARTIAL / PASS | PASS / PASS | Completion explanation, collected-versus-assembled copy, creation/paused-setup return paths |
| 2 | PASS / PARTIAL | PASS / PASS | Dedicated history and return paths, including 390px mobile |
| 3 | PASS / PARTIAL | PASS / PASS | Incomplete-goal history, View goal, browser Back/Forward and return to Activity |
| 4 | PASS / PASS | PASS / PASS | Main sections and sampled details/forms, including 320px mobile |
| 5 | PASS / PASS | PASS / PASS | Main sections, filters/search, creation form, sampled details and history |

Visitor 3 also encountered an account-verification rate limit on one fresh-tab attempt; that blocked PARTIAL/FAIL report remains preserved. A later fresh tab entered automatically after cooldown without Retry verification, then the same-goal navigation passed. Sustained provider availability is not established by that recovery.

Minor observations remain: complete-looking template posters rely on nearby preview/funding labels, the mobile update banner occupies space, detail document titles say Dashboard, Reached includes already-collected goals, and mobile models precede the monetary summary as requested by the user. No final reviewer established an unresolved P1/P2 within the tested read-only paths. This does not establish a perfect numeric UI score.

The five original context-free reviews and subsequent immutable reports/screenshots remain private in `.local/blind-recheck-2026-10-08`. They used an existing authenticated profile, not isolated new accounts. Setup execution, deposit/completion/claim success, fresh Google login and physical-device/PWA acceptance were not retested by these reviewers. UI-displayed receipt statuses are not independently verified transaction proof.

## Restored-session request reduction

The client previously refreshed the SDK user on every workspace open, even when its ready profile already listed both owners. A restored matching profile now first verifies a fresh backend session, including identity/app/network and matching EVM/Solana owners, and reuses those wallets without another SDK refresh. Missing/changed owners still follow the original provision/refresh/verify flow. Backend errors or wrong identities never grant access, and no substitute wallet is created to bypass an outage. This reduces redundant provider calls; it does not guarantee that external rate limits cannot occur.

Frontend unit coverage is now 79/79, including restored-profile backend-failure/identity/owner checks. Three wallet-onboarding browser checks passed; production build and release-shell checks remain separate from live fresh-account financial acceptance.
