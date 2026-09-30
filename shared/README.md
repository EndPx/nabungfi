# @nabungfi/shared

The common TypeScript package for NabungFi. It contains exact USDC conversion, chain/lifecycle types, the reference savings state machine, its public-state projection and regression tests. The local API uses the model; the local web app imports the response types. Response types are derived from `publicState`, rather than maintained as a second interface definition.

The current `Model.goal` is singular. Supporting several concurrent goals per user is required; an owner-scoped collection, goal-targeted transitions and migration of existing state are pending. See [multiple-goal requirements](../docs/MULTI_GOAL_REQUIREMENTS.md). The current replacement-style create-goal operation does not satisfy that requirement.

## Use

Declare `"@nabungfi/shared": "workspace:*"` in a consumer package inside this workspace.

```ts
import { parseUSDC, transition, type AppState, type Chain } from "@nabungfi/shared";
```

The package exports TypeScript source for workspace consumers. Build emits declarations and JavaScript to the ignored `dist/` directory. It has no browser, server, wallet, RPC or private research dependency. The reference model simulates crosschain coordination; it does not verify chain proofs or move funds.

## Verify

From the repository root:

```sh
pnpm --filter @nabungfi/shared test
pnpm --filter @nabungfi/shared typecheck
pnpm --filter @nabungfi/shared build
```

The existing 14 tests exercise exact units, lock/claim rules, idempotent actions, reserve freezes, liquidity/loss cases and irreversible achievement. The same accounting logic was moved from the former domain package; contract implementations remain in `contracts/`.
