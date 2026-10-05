# Vercel frontend deployment

Use the NabungFi monorepo with **Root Directory `apps/web`**, framework **Vite**, Node **24.x**, install command `pnpm install --filter @nabungfi/web... --frozen-lockfile`, build command `pnpm build`, and output directory `dist`. Include files outside the root directory so the workspace package `shared` and root pnpm lockfile are available. The filtered install selects the frontend and its workspace dependencies. The committed `vercel.json` defines SPA navigation, public static asset caching and basic browser security headers. It does not host the API or keeper.

Set these public build variables in each approved deployment environment:

| Variable | Value |
| --- | --- |
| `VITE_PRIVY_APP_ID` | The public Privy app ID for this project |
| `VITE_API_ORIGIN` | The chosen API's HTTPS origin, without a path or credentials |
| `VITE_DISABLE_REACT_DEVTOOLS` | `1` |

`VITE_API_ORIGIN` is required for a separately hosted Vercel frontend. Leave it empty only if an explicitly configured same-origin API proxy exists. It is not a server secret. Never add `PRIVY_APP_SECRET`, `DATABASE_URL`, signer files, private keys or explorer API keys to frontend variables. Vite embeds all `VITE_*` values in public JavaScript.

After the frontend URL and API host are chosen, authorize the exact frontend URL in the Privy application's allowed origins and in the API CORS allowlist. Do not authorize every `vercel.app` site. Add approved preview URLs individually when preview authentication is needed. The application uses Privy client wallet creation and user confirmations; it does not create delegated server wallets or expose wallet keys to the API.

The Privy provider offers email and wallet login, requests embedded EVM/Solana wallets for users without wallets, and keeps external wallet connections available. A missing wallet family can be created explicitly from Wallets. Owner choices remain unavailable until the API verifies the updated Privy user. New wallets have no invented gas or USDC balance; fund testnet gas and Circle test USDC before signing setup or deposits.

Verify the deployed build, not only localhost:

1. Confirm `/manifest.webmanifest`, the 192/512/maskable icons and `/sw.js` return their proper content types. SW/index must revalidate; hashed assets can be immutable.
2. Check sign-in, verified wallet ownership, metadata persistence across reload, per-goal setup and transaction review through the chosen HTTPS API.
3. Have the wallet owner confirm a testnet transaction, then check its original hash through backend receipt reconciliation. A prepared unsigned plan is not evidence of execution.
4. Check 320/390/768/1024/1440px reflow, keyboard focus, mobile bottom navigation, safe areas, reduced motion and muted audio.
5. Install on a supported browser or use Safari's Share → Add to Home Screen. Offline mode may serve the public shell but cannot send or replay financial actions.
6. Leave an unresolved wallet request and confirm an update cannot interrupt it. Reconcile or owner-attest a recognized wallet rejection before choosing Update.

The release remains a testnet app with cash USDC and goal locks. The API and operator have a separate native VPS deployment; see [VPS evidence](../../docs/VPS_DEPLOYMENT.md). Mainnet deployment and strategy yield require separate verification. Vercel publication and its exact Privy/API origin checks remain pending. Builds in a Vercel environment fail early if the public Privy app ID or a valid HTTPS API origin is missing. Local production previews can still use an explicit same-origin API proxy.

Primary references: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Privy React installation](https://docs.privy.io/basics/react/installation), and [Privy Solana transaction flow](https://docs.privy.io/wallets/using-wallets/solana/send-a-transaction).
