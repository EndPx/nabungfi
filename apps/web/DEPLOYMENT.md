# Vercel frontend deployment

The frontend is live at **https://nabungfi.endpx.cloud**, owned by the EndPx Vercel project. Landing: `/`; sign-in: `/login`; protected workspace: `/app/goals`. The first EndPx Git deployment is `dpl_4JS8vGx12Afyb7w4tPw2cpTu3sgQ`, built from pushed commit `81b9a25d0b8b8bd3f95022f1f3097da653b35d36` on 7 October 2026 in Asia/Jakarta. [EndPx release record](deployments/vercel-endpx-2026-10-07.json). The original 5 October `nabungfi.vercel.app` publication remains [historical evidence](deployments/vercel-testnet.json); the new primary domain is the custom domain above.

Use the NabungFi monorepo with **Root Directory `apps/web`**, framework **Vite**, Node **24.x**, install command `pnpm install --filter @nabungfi/web... --frozen-lockfile`, build command `pnpm build`, and output directory `dist`. Include files outside the root directory so the workspace package `shared` and root pnpm lockfile are available. The filtered install selects the frontend and its workspace dependencies. The committed `vercel.json` defines SPA navigation, public static asset caching and basic browser security headers. It does not host the API or keeper.

Set these public build variables in each approved deployment environment:

| Variable | Value |
| --- | --- |
| `VITE_PRIVY_APP_ID` | The public Privy app ID for this project |
| `VITE_API_ORIGIN` | The chosen API's HTTPS origin, without a path or credentials |
| `VITE_DISABLE_REACT_DEVTOOLS` | `1` |

`VITE_API_ORIGIN` is required for a separately hosted Vercel frontend. Leave it empty only if an explicitly configured same-origin API proxy exists. It is not a server secret. Never add `PRIVY_APP_SECRET`, `DATABASE_URL`, signer files, private keys or explorer API keys to frontend variables. Vite embeds all `VITE_*` values in public JavaScript.

After the frontend URL and API host are chosen, authorize the exact frontend URL in the Privy application's allowed origins and in the API CORS allowlist. Do not authorize every `vercel.app` site. Add approved preview URLs individually when preview authentication is needed. The application uses Privy client wallet creation and user confirmations; it does not create delegated server wallets or expose wallet keys to the API.

The Privy provider offers Google, email and wallet login, with embedded EVM/Solana wallet support and external wallet connections. A missing wallet family can be created explicitly from Wallets, including after headless OAuth. Owner choices remain unavailable until the API verifies the updated Privy user. New wallets have no invented gas or USDC balance; fund testnet gas and Circle test USDC before signing setup or deposits.

## Google sign-in

The frontend now includes a direct `Continue with Google` action using the installed Privy `useLoginWithOAuth` hook, alongside email and wallet. Loading blocks overlapping methods; errors do not echo OAuth responses, and a successful provider session still requires the same matching backend identity before workspace access. The original Google G PNG is served locally at `/providers/google.png`, sourced from [Google's sign-in branding page](https://developers.google.com/identity/branding-guidelines) and included in the public PWA asset cache.

Google was enabled and saved for the exact NabungFi application on 7 October after user approval. The public app configuration reports `google_oauth: true`. This development app uses Privy's existing default credentials; Return OAuth tokens remains off and additional scopes remain empty, leaving the basic `openid`, `email`, `profile` scopes. No Google Cloud security setting or OAuth credential was changed. Custom credentials and branding can be configured separately after the account owner completes Google Cloud's MFA requirement. [Privy provider configuration](https://docs.privy.io/basics/get-started/dashboard/configure-login-methods#default-vs-custom-credentials) · [Privy OAuth hook](https://docs.privy.io/authentication/user-authentication/login-methods/oauth).

Source verification: the production build, 48 unit checks and 32 isolated browser checks passed for the Google implementation; 13 targeted checks passed after the login grouping and copy cleanup. These fixtures use synthetic sessions. The live EndPx release was verified separately: the browser reached authenticated Goals and Settings through the matching backend-session gate, and the same active account's connected Google identity was confirmed in Privy's user details. No OAuth token or OTP was copied and no financial transaction was performed.

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

The 5 October inspection reported an empty `allowed_domains` list. No Privy dashboard settings or credentials were changed during that initial deployment. Its SDK initialization and wallet picker evidence did not establish a completed authenticated user session. The later EndPx release adds the separate activation/session evidence below. Private original HTTP, browser and screenshot evidence is under `.local/vercel-qa/`.

## EndPx domain and Google release — 7 October 2026

The new `nabungfi` project belongs to EndPx under `muhammad-meidy-noor-al-barrys-projects`, uses `apps/web`, and is connected to `EndPx/nabungfi` on GitHub. Vercel built the actual pushed Git commit and served the custom domain over verified HTTPS. The project contains only the three public build variables above. The existing VPS origin allowlist already included the custom domain, so no backend restart or keeper relocation was needed.

Only one Hostinger DNS record was added: CNAME `nabungfi` → `ed3eabdf8ee11d8d.vercel-dns-017.com`, TTL 300. All 15 existing DNS records matched the before/after inspection. Nameservers, API DNS and other application records were not changed. Vercel's domain configuration reported CNAME with `misconfigured: false`.

Twenty-two live HTTP checks passed for the new host: SPA routes, original network PNGs, Google provider mark, manifest/icons, service-worker policy, immutable JavaScript, exact API CORS, authorization preflight, preserved original origin and rejection of unknown/HTTP origins. The API and keeper remained active. The authenticated browser displayed zero owner-scoped goals and the actual account, then allowed read-only app navigation. The connected Google account was verified in Privy. Signed browser financial actions and physical-device PWA installation remain separate gates. Private evidence is under `.local/endpx-live-qa/`.

## Subsequent releases

The current Vercel project is `nabungfi` under `muhammad-meidy-noor-al-barrys-projects`, project ID `prj_XnsXSFYNgx2lpIUtoWfxxZglHjKG`. Its Git repository is `EndPx/nabungfi`, production branch `main`. Pushing an approved release to `main` can now create a Git deployment; confirm its original source commit, Ready status and custom-domain mapping. Isolated UI development may use a `codex/` branch with protected previews before promotion. Do not authorize all preview domains in the API. Follow [Vercel's monorepo CLI instructions](https://vercel.com/docs/monorepos#add-a-monorepo-through-vercel-cli) when using a clean checkout.

The old project under `openclaws-projects-4eb1d9c1` is outside the current EndPx account's access and was not overwritten or deleted. New frontend releases use `nabungfi.endpx.cloud`. The API retains the original exact `https://nabungfi.vercel.app` origin for continuity. Additional preview origins must be approved individually before authenticating against the live API.

Primary references: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Privy React installation](https://docs.privy.io/basics/react/installation), and [Privy Solana transaction flow](https://docs.privy.io/wallets/using-wallets/solana/send-a-transaction).
