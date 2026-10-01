# Fresh external-owner backend lifecycle acceptance

`owner-lifecycle-test.ts` is an authoring module. Invoking it directly exits without running the flow. It imports no keypair, keystore, signer SDK, environment secrets or SQL cleanup logic. A reviewed private Root launcher must explicitly call it after the resource and execution gate.

The test exercises an actual HTTP API backed by the actual Neon repository and actual chain service. Authentication is **an isolated synthetic fixture**, not a real Privy JWT or Privy UI session. The fixture requires a unique `did:privy:nabungfi-owner-fixture-<UUID>` subject, a private one-run bearer token, public owner addresses distinct from both operator addresses, `production:false`, and a server bound internally to `127.0.0.1`. Normal `src/index.ts` never imports or enables this authentication.

The exported setup helper is `startOwnerFixtureServer({profile,acknowledgement,config,repo,chain,runtime,identity,fixtureToken,port?})`. It returns `{server,baseUrl,close}`. Root supplies its actual configured repository, chain service and coordination runtime; the public helper does not read credentials or migrate/delete records.

The runner is `runOwnerLifecycle(options)`. Required inputs include:

- `profile: 'owner-fixture-sol-base-v2'` and acknowledgement `RUN_FRESH_TESTNET_FIXTURE_WITH_EXTERNAL_OWNER_SIGNATURES`.
- A stable UUID `runId`, the isolated fixture URL/token and immutable fixture public identity.
- `checkpoint(journal)`, implemented by Root as a durable private write.
- `sendPlan(plan, {label,deadline,recordOriginalHash})`, implemented only in Root's private external CLI adapter.
- `collectMessageSources(binding)`, which reads the real operator journal for that exact goal.

The external adapter must validate and sign the exact unsigned plan using the actual owner, independently of the operator. It must durably save its original signed bytes/hash in private state, call and await `recordOriginalHash(hash)` **before broadcast**, submit the original bytes only and return the same hash. An ambiguous broadcast is reconciled using that hash. An attempted signer without a durable hash stops the flow; it cannot be reset by the runner. Do not implement the callback with generated hashes or mocked receipt callbacks for acceptance.

The fixed goal is 2 USDC on Solana Devnet and Base Sepolia. The runner reserves fresh metadata through HTTP, creates/verifies the actual Base vault, initializes the Solana goal, waits for authenticated registration, deposits exactly 1 USDC on Solana and 1 USDC on Base with a finite approval, waits for fresh authenticated NAV, requests owner-signed preparation, waits for actual READY/COMMIT, claims exactly 1 USDC per chain and waits for absolute zero reports. Every signer call is preceded by the API wallet-start marker. Every owner action is reconciled through its immutable API step and original receipt.

The journal stores the original fixed deadline across restart. Poll sleeps never exceed 30 seconds. It preserves metadata IDs, request IDs, hashes, funded goals and wallet-start markers on failure. It never issues DELETE/reset, abandons a funded goal, replaces a nonce, or fabricates an initial balance after funding. The final owner USDC balances must match the actual pre-deposit baseline.

Completion additionally requires the actual LayerZero testnet Scan response for every supplied source hash: configured DVN verification succeeded, no configuration error, `DELIVERED`, destination transaction present and a 222-byte version-2 payload binding the exact goal, owner, leaf and selected domain. The original REGISTER/REGISTERED, PREPARE, READY, COMMIT and positive/zero PROGRESS messages must all be present. This evidence is separate from API/database and owner-receipt evidence.

Retain the fixture's goal, steps, receipts and operator history on any failure. After complete claims, apply the reviewed operator archive/admission-retirement procedure before considering any scoped SQL cleanup. This module performs no cleanup itself. A fixture-auth lifecycle pass must remain labeled as such; real Privy authentication/signing acceptance is a separate release gate.

The accompanying unit tests use scripted HTTP responses and synthetic payloads solely to check orchestration invariants. They are not public-chain transaction evidence or real Privy authentication evidence.
