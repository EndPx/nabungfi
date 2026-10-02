# NabungFi web app and PWA

The React/Vite app connects Privy authentication to the authenticated application API, presents multiple isolated savings goals and sends unsigned transaction plans to the selected owner wallet only after explicit review. The original car, laptop, house and custom build each contain exactly 100 procedural components, with shared assembly animation, optional building audio and reduced-motion controls. Visual assembly never authorizes financial transfers.

## Run from the repository root

Use Node.js 24 and pnpm 10.21.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Configure the ignored `apps/server/.env` as described in the [authenticated API setup](../server/README.md), then open `http://127.0.0.1:5173`. The root command starts the authenticated API at port 3001, not the sample ledger. For the built UI:

```sh
pnpm build
pnpm preview
```

Open `http://127.0.0.1:4173`. Vite proxies `/api` to the local server in both modes.

## Checks and configuration

```sh
pnpm --filter @nabungfi/web test
pnpm --filter @nabungfi/web typecheck
pnpm --filter @nabungfi/web build
pnpm --filter @nabungfi/web test:browser
```

Tests cover request recovery, identity preservation, ambiguous responses, exact USDC amounts, user isolation, signature encoding, presentation thresholds and stable 100-component geometry. Set `VITE_PRIVY_APP_ID` in the ignored `.env`; only the public application ID belongs in frontend configuration. Server secrets and database credentials must never be client variables. The deployment origin must be allowed in the Privy dashboard.

Browser checks use isolated fixtures under `tests/browser`, with no API calls or wallet signing. Install Playwright Chromium using `pnpm --filter @nabungfi/web exec playwright install chromium`, or set `PW_BROWSER_CHANNEL=msedge`/`chrome` to use an installed browser. They cover narrow-screen reflow, lock consent, exact deposit input, completion/claim controls, unavailable balances, keyboard focus restoration and automated WCAG AA checks. They do not establish real wallet financial execution.

The guest 3D model is labelled as a nonfinancial preview. For the legacy sample ledger run `pnpm dev:demo` and open `?demo=1`. Small contributions update a fractional next-piece tray; they never place an unfunded whole component. An exact USDC approval returns to a separate deposit review with the same amount and chain, without automatic wallet signing.

The main route displays authenticated testnet state. `?demo=1` is the explicit legacy local demo with sample funds, and `?showcase=models` is a clearly labeled visual QA harness with example piece counts and no financial actions. The genuine four-chain contract/keeper proof is described in the [concurrent runbook](../../docs/CONCURRENT_GOALS_RUNBOOK.md). [Asset provenance](ASSET_PROVENANCE.md) describes the original procedural models, edited audio and local-only original recording.

## PWA and production deployment

The frontend deployment target is Vercel. Follow [deployment configuration](DEPLOYMENT.md) to set the monorepo root, public API origin, approved Privy/CORS domains and production verification steps. The API and keeper already have a separate [native VPS deployment](../../docs/VPS_DEPLOYMENT.md). See [frontend acceptance](../../docs/FRONTEND_ACCEPTANCE.md) for current evidence and remaining gates.

The production build emits `manifest.webmanifest`, original install icons and a service worker whose build-generated cache holds versioned public static assets. API/auth responses, wallet traffic, non-GET requests and other origins never enter the cache. There is no offline mutation queue. New versions wait for an explicit Update action; the button is disabled while requests need reconciliation. iOS install guidance and the standard browser install event are handled separately. A full install test needs HTTPS (localhost is permitted for development).

Host the built `dist` directory through the authenticated backend or a reverse proxy sharing the same origin with `/api`. Serve `/sw.js` and `/index.html` with revalidation, hashed assets with immutable caching, and rewrite app navigation to index.html while preserving `/api` routing. Keep previous hashed assets available during deploy until open tabs update; replacing files under a running old tab can break lazy wallet chunks. Never cache authenticated responses at a CDN. The Vite preview proxy is development tooling, not a production server.

For separate frontend/API hosting, set the public `VITE_API_ORIGIN` to the API's HTTPS origin at build time. It cannot include credentials, a path, query or fragment. Leave it empty for same-origin hosting or the local Vite proxy. The API must explicitly allow the frontend origin in CORS; the client sends Privy bearer tokens, without cross-origin cookies.

User wallet signing is the final confirmation step. Connection failures preserve the original request ID or submitted hash, and the recovery panel never silently sends a replacement transaction. This release uses test tokens and cash USDC; actual strategy yield is not active. Typechecks and unit tests do not substitute for a confirmed connected-wallet lifecycle test.

Before a wallet request, the client independently checks the saved original intent, canonical deployed destinations, exact EVM calldata and Solana message contents, derived goal/cash/ATA accounts, configuration hash, signer permissions and unsigned message lifetime. A recomputed server-provided digest cannot authorize unlimited approvals, another spender, changed amounts, extra instructions or substituted accounts. Tests use synthetic unsigned golden wires produced by the server codec; these are protocol compatibility evidence, not network execution.

A server marker is required before calling the wallet SDK. A direct numeric EIP-1193 `4001` rejection from that SDK call can be recorded as an authenticated owner attestation. Only after the server acknowledges `rejected` with no transaction hash does the matching unsubmitted local recovery entry close. This is not onchain failure proof, does not cancel a submitted transaction, and never automatically sends a replacement. HTTP failures, timeouts, unknown marker results and submitted hashes remain recoverable through their original identity.
