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
