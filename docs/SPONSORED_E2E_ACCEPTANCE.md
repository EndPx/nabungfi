# Sponsored browser lifecycle acceptance

Verified on the public NabungFi deployment on 9 October 2026. An existing authenticated Privy account created an isolated camera goal with an immutable **0.02 testnet USDC** target, selecting **Solana Devnet and Base Sepolia**. All owner approvals ran through the actual deployed interface and Privy confirmation dialogs. No application authentication was replaced with a fixture and no private keys were exported.

The eight original owner operations were:

1. Create the Base vault.
2. Initialize the Solana goal.
3. Deposit 0.01 USDC on Solana.
4. Approve exactly 0.01 USDC for the Base vault.
5. Deposit 0.01 USDC on Base.
6. Prepare completion on Solana after fresh authenticated reports matched the target.
7. Claim 0.01 USDC on Solana after verified completion.
8. Claim 0.01 USDC on Base after its completion message arrived.

Every operation reached `confirmed` through the application's original-receipt endpoint. The final audit independently re-verified all eight stored receipts and read the actual contract/program balances. The final state was `claimed`, with `totalAssetsRaw = 0`, `totalClaimedRaw = 20000`, and permanent `achievedTotalRaw = 20000`. Each vault's remaining USDC was zero. Both owner wallets returned to their exact starting USDC balance. Owner native balances were unchanged through this lifecycle. The interface displayed Collected, 100% progress, both chain rows collected, and a completed 100-piece camera build.

## Corrections found during live testing

- Privy's EVM path used the canonical Kernel v3.3 delegate, including a zero-price testnet bundler operation without a paymaster. Verification now supports that envelope while preserving exact owner, call, goal, token effects, canonical block and user-operation identity.
- Sponsored Solana initialization prepended a sponsor-to-owner rent transfer. Verification permits only the exact canonical account-creation rent or funding deficit, with payer debit equal to grant plus network fee and confirmed native conservation. It supports both a zero-SOL owner and an already-funded owner whose rent is fully sponsored.
- Solana static account tables may be reordered during sponsorship. Verification compares the complete resolved key set, signer/writable permissions, ordered instructions and exact data; unrelated accounts/instructions and lookup tables remain rejected.
- A legacy deposit modal still required owner ETH/SOL even for an eligible sponsored wallet. Eligibility now comes from the server capability and authoritative linked embedded goal owner. Direct wallets retain their gas requirement. Background reads retain draft input and give visible waiting feedback.
- Recovery exposes an explorer link, full-hash disclosure and copy control, and separates attempted requests from expired unsigned plans. Testnet chain configuration includes the correct explorer URLs.

An expired unsigned Solana prepare plan was refreshed under its original step identity before signing. The initial fully-funded-owner rent receipt was rechecked under the corrected verifier using the same signature. No signed operation was replaced or resent.

## Evidence and scope

Private evidence under `.local/sponsored-e2e-live/` contains the original receipt hashes, final RPC/database audit, screenshots and validation output. Keep account identities and personal wallet details outside the public repository. Validation also passed 58 server tests, 80 web tests, three zero-gas/draft browser cases, production build and the actual production PWA shell check.

This acceptance establishes the sponsored **Base + Solana** browser lifecycle, including real message-driven registration and completion. It does not certify sponsored Arbitrum/Ethereum Sepolia lifecycle execution, a fresh physical-mobile login, arbitrary Solana rent grants, yield, or mainnet readiness. No mainnet action, paid credit purchase, payment-method addition or real-money spending occurred.
