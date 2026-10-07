# Automatic owner-wallet onboarding — 8 October 2026

A mobile Google/email user could reach Wallets with no verified wallets and manual Create EVM/Create Solana buttons. The app configured `createOnLogin`, but its Google OAuth and email OTP handlers use Privy's custom login interfaces. Privy's [automatic creation documentation](https://docs.privy.io/basics/react/advanced/automatic-wallet-creation) explicitly limits that configuration to the built-in modal. Custom login must invoke the [client wallet-creation hooks](https://docs.privy.io/wallets/wallets/create/create-a-wallet).

The app now runs one explicit onboarding flow after real Privy authentication, including restored accounts that still lack wallets. It refreshes the SDK user, creates only a missing Ethereum or Solana family, refreshes the user after creation, and waits for both authoritative wallet families in a matching backend session before opening the workspace. Ethereum wallets serve the three supported EVM networks. Existing linked owners are reused; no additional-wallet flag or server signer is supplied. Provider modal auto-creation is disabled so custom and wallet-modal login share the same provisioning path.

The fullscreen approved N loader says **Preparing your wallets…**. Goal reads and background balance polling wait until wallet onboarding succeeds. A creation or ownership-sync failure returns the existing verification error/retry/sign-out screen. Retry refreshes ownership first; a successful EVM creation is preserved when Solana creation fails. SDK already-exists errors are accepted only if a fresh user profile confirms that family. Backend propagation retries are bounded to eight reads. An account switch or logout stops the old flow before its next creation/read can be accepted. Offline startup creates no wallets.

## Verification

- The frontend unit suite passed **70 tests**, including eight new onboarding cases: both families, existing/partial wallets, concurrent-render deduplication, second-family retry, already-created reconciliation, delayed/bounded backend propagation, identity changes, wrong account/application and offline rejection.
- **11 targeted browser tests** passed. The production onboarding hook ran in a StrictMode fixture at 390px: custom sign-in requested both families automatically, the workspace remained absent through delayed backend ownership, and the final Wallets page showed both cards with no Create-wallet buttons or horizontal overflow. Restored empty accounts, failure/retry without duplicate EVM creation, existing owners, and offline startup were covered.
- Production typechecking/build passed. The production PWA release-shell suite passed six checks for route CSS, standalone manifest, cold offline launch, retained wallet modules, disabled offline authentication/signing, and no private API cache/financial requests.

These automated wallet-creation callbacks and accounts are isolated examples, not a newly authenticated real Google account or a physical-phone execution. The earlier public owner-signed financial evidence remains in [browser E2E acceptance](BROWSER_E2E_ACCEPTANCE.md). This change does not alter goal bindings, custody programs, financial journals, or signing authorization.

An installed PWA may keep the old worker until the user accepts its update. Use the existing Settings update action when available, then reload/reopen the app. The app must still defer updates during an unresolved financial wallet request.

Reproduce:

```sh
pnpm --filter @nabungfi/web test
pnpm --filter @nabungfi/web exec playwright test auth.spec.ts wallet-onboarding.spec.ts
pnpm --filter @nabungfi/web build
pnpm --filter @nabungfi/web test:pwa:release
```
