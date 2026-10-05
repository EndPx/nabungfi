# Vercel frontend deployment

The testnet frontend is live at **https://nabungfi.vercel.app**. Landing: `/`; sign-in: `/login`; protected workspace: `/app/goals`. The Vercel production deployment is `dpl_EmTxEFBU74U6FE1XKwBmaFqQSUQt`, built from pushed commit `10f75f78b934e86f1a8b270b42877f3f39ef3b50` on 5 October 2026. [Sanitized release record](deployments/vercel-testnet.json).

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

## Google sign-in

The frontend now includes a direct `Continue with Google` action using the installed Privy `useLoginWithOAuth` hook, alongside email and wallet. Loading blocks overlapping methods; errors do not echo OAuth responses, and a successful provider session still requires the same matching backend identity before workspace access. The original Google G PNG is served locally at `/providers/google.png`, sourced from [Google's sign-in branding page](https://developers.google.com/identity/branding-guidelines) and included in the public PWA asset cache.

Enable Google for the exact NabungFi application on Privy's Authentication → Login methods page before promoting this source build. The development app can use Privy's existing default credentials, so Google Cloud Client ID/secret setup is optional at this stage. Leave Return OAuth tokens off and additional scopes empty; the basic provider scopes are `openid`, `email`, `profile`. Google Cloud currently requests account MFA for console access; no Google Cloud security or OAuth credentials were changed during this implementation. Custom credentials and branding can be configured separately after the account owner completes that requirement. [Privy provider configuration](https://docs.privy.io/basics/get-started/dashboard/configure-login-methods#default-vs-custom-credentials) · [Privy OAuth hook](https://docs.privy.io/authentication/user-authentication/login-methods/oauth).

Source verification: the production build, 48 unit checks and 32 isolated browser checks passed, including Google failure recovery, loading isolation, offline/unconfigured denial, matching/mismatched backend identities, original goal destination and responsive/accessibility checks. These fixtures use synthetic sessions and do not constitute a completed Google authentication. Provider activation and a refreshed Vercel deployment must be verified separately.

Verify the deployed build, not only localhost:

1. Confirm `/manifest.webmanifest`, the 192/512/maskable icons and `/sw.js` return their proper content types. SW/index must revalidate; hashed assets can be immutable.
2. Check sign-in, verified wallet ownership, metadata persistence across reload, per-goal setup and transaction review through the chosen HTTPS API.
3. Have the wallet owner confirm a testnet transaction, then check its original hash through backend receipt reconciliation. A prepared unsigned plan is not evidence of execution.
4. Check 320/390/768/1024/1440px reflow, keyboard focus, mobile bottom navigation, safe areas, reduced motion and muted audio.
5. Install on a supported browser or use Safari's Share → Add to Home Screen. Offline mode may serve the public shell but cannot send or replay financial actions.
6. Leave an unresolved wallet request and confirm an update cannot interrupt it. Reconcile or owner-attest a recognized wallet rejection before choosing Update.

The release remains a testnet app with cash USDC and goal locks. The API and operator have a separate native VPS deployment; see [VPS evidence](../../docs/VPS_DEPLOYMENT.md). Mainnet deployment and strategy yield require separate verification. Builds in a Vercel environment fail early if the public Privy app ID or a valid HTTPS API origin is missing. Local production previews can still use an explicit same-origin API proxy.

## Observed live release — 5 October 2026

Vercel's cloud build completed and the production alias returned public HTTP 200 without a Vercel account. Deployment used the official CLI with a clean `git archive` of the pushed source commit, containing tracked files only. No local `.env`, research, private runtime state or credentials were uploaded. The project contains only the three public build variables listed above; its API origin is `https://nabungfi-api.endpx.cloud`.

Twenty-one live HTTP checks passed: SPA entry paths, manifest and four network PNGs, 192/512/maskable icons, service-worker content type and no-store policy, immutable hashed JavaScript, exact API CORS, authenticated endpoint denial, authorization preflight, preserved planned origin and rejected unknown/HTTP origins. The API allowlist change affected only `nabungfi-api`; both API and keeper were active afterward and the keeper PID was unchanged.

The live browser exercised landing → Open app → `/login`, initialized the real Privy SDK and opened its MetaMask/Coinbase/Rainbow/Other wallets picker. `/app/goals?goal=car-example` redirected to sign-in with its original internal destination retained and no workspace navigation. Landing and login DOM reflow checks passed at 320/390/768/1440px. The public preview rendered the 100-piece car and exposed assembly/orbit controls. No console errors were recorded during these checks.

The public Privy application configuration currently reports an empty `allowed_domains` list. No Privy dashboard settings or credentials were changed for this deployment. SDK initialization and the wallet picker establish availability from the live origin; they do not establish a completed authenticated user session. Genuine email/OTP or owner-wallet sign-in, matching backend redirect, financial actions and physical-device PWA installation remain separate acceptance steps. Private HTTP, browser and screenshot evidence is under `.local/vercel-qa/`.

## Subsequent releases

The Vercel project is `nabungfi` under `openclaws-projects-4eb1d9c1`. Its GitHub connection was rejected because the signed-in Vercel account lacks repository write/admin access. This release is published through CLI; pushing GitHub alone does not trigger a new deployment until the Git integration is authorized. Do not claim automatic deployment is enabled. Link an approved clean source checkout to this project, deploy from its monorepo root with `vercel deploy --prod`, and verify the resulting alias and source revision. Follow [Vercel's monorepo CLI instructions](https://vercel.com/docs/monorepos#add-a-monorepo-through-vercel-cli).

The custom frontend origin `https://nabungfi.endpx.cloud` remains reserved in the API allowlist but no frontend DNS/domain change was made. Additional preview origins must be approved individually before authenticating against the live API.

Primary references: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Privy React installation](https://docs.privy.io/basics/react/installation), and [Privy Solana transaction flow](https://docs.privy.io/wallets/using-wallets/solana/send-a-transaction).
