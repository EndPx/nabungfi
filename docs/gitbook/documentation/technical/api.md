---
description: "Account-scoped reads, exact unsigned steps and original-outcome reconciliation."
---

# API and Application Data

The application API serves the authenticated workspace at `https://nabungfi-api.endpx.cloud`. Privy verifies the account and authoritative linked wallets; the application repository scopes every goal and history read to that user.

## Responsibilities

The server stores goal metadata, derives immutable bindings, checks coordination admission, prepares unsigned financial actions and reconciles exact original receipts. It does not hold the user’s exported wallet key or submit financial transactions as the goal owner.

| Resource | Responsibility |
| --- | --- |
| Session and configuration | Match the account, application and supported testnet capabilities |
| Goal collection/detail | Owner-scoped metadata and freshly validated financial snapshots |
| Wallet balances | Linked-wallet USDC/native reads independent of goal creation |
| Goal steps | Reserve original action identities, save plans and retain attempted outcomes |
| History and recovery | Read accepted receipt records; distinguish unsigned from already-started requests |

Amounts travel as canonical atomic decimal strings. USDC has six decimals; financial parsing does not use floating-point money arithmetic. Plan fingerprints cover the canonical exact plan, and server constraints retain immutable request identity.

## Financial request boundaries

The chain planner checks the immutable binding and current eligibility. A refreshed unsigned plan remains attached to its original step. The wallet-start transition happens before SDK approval/signing, so an interrupted response remains recoverable.

Reconciliation checks the original hash or signature and its exact effect. Direct rejection, never-invoked attestation and finalized-history expiration are distinct transitions. A different receipt is rejected without silently binding its hash.

Authenticated responses are `no-store`. CORS is limited to configured app origins; request and concurrent chain-read bounds protect the verification path. Errors retain the original intent rather than encouraging blind repeats.

This page describes application responsibilities rather than a generated OpenAPI contract. The implementation is available in the [authenticated server source](https://github.com/EndPx/nabungfi/blob/main/apps/server/src/application-server.ts), with [wallet balance semantics](https://github.com/EndPx/nabungfi/blob/main/docs/WALLET_BALANCES.md) documented separately.
