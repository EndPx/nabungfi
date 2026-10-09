# Testnet gas sponsorship

NabungFi requests Privy's native gas sponsorship for verified embedded goal owners on Base Sepolia (84532), Arbitrum Sepolia (421614), Ethereum Sepolia (11155111), and Solana Devnet. The app requests **app pays**, not stablecoin-paid user gas. External wallets keep direct payment. Users still confirm every financial action in their wallet.

The Privy app has gas sponsorship and client transactions enabled for exactly those four testnets. Its prepaid balance is $0; no credit purchase or payment method was added. Mainnets and swap fee sponsorship are excluded. Dashboard configuration alone is not evidence that a zero-credit request was sponsored onchain.

## Application boundaries

- `NABUNGFI_TESTNET_GAS_SPONSORSHIP=true` enables server-selected sponsorship. Eligibility requires the authenticated authoritative Privy linked account to identify the exact goal owner as an embedded wallet with a wallet ID. The client cannot supply a payment mode in request bodies.
- Clients advertise `X-NabungFi-Plan-Version: gas-v1`. Older installed PWAs keep direct plans. A client without this capability cannot start a sponsored plan. Refreshing an unsigned plan can select the current mode; attempted plans cannot change their fingerprint or outcome.
- The React SDK receives `sponsor: true`, the exact owner, canonical testnet, destination, calldata, and amount. Confirmation UI remains enabled. There is no automatic paid fallback or gas payment in USDC.
- EVM owner-operation verification supports canonical EntryPoint v0.7, Alchemy's published SemiModularAccount7702 delegates, and Kernel v3.3 at its canonical CREATE2 deployment. It requires one matching owner operation, one exact call (or a single-call batch), a paymaster or a third-party bundler with zero operation gas pricing and zero actual user-operation gas cost, the correct user-operation event/hash, a canonical block, chronology, and two confirmations. Other account/envelope formats are rejected. Each operation's logs are isolated from the other bundled users; an outer successful bundle does not imply successful owner execution. Additional token payment/approval cannot pass the owner's conservation check.
- Migration 011 preserves global uniqueness for direct transaction receipts and adds global uniqueness for sponsored user-operation receipts. Different owners can share a bundle hash; the same operation cannot confirm another action.
- Sponsored Solana receipts permit only payer/blockhash replacement and removal of the old fee payer's implicit owner writability. Owner signing, instructions, accounts, programs, mint, amount, and token conservation remain checked. Lookup tables and extra instructions are rejected. The unsigned blockhash's expiry cannot prove a sponsored request was never executed; recovery requires the actual original signature.
- Solana custom-program account rent remains separate. Only pre-execution fee-payer funding errors may be deferred to Privy's mandatory simulation. Instruction failures, including insufficient rent, remain blocking. This feature does not promise that a fresh zero-SOL wallet can fund the initial goal PDA.

## Verification status

Local server tests cover substituted operations, extra calls, unsupported networks, paymaster absence, wrong events, inner failure, cross-operation log isolation, fee conservation, preserved Solana signing, safe unknown-outcome recovery, and old-PWA negotiation. Database verification ran against real Neon through migration 011, including shared-bundle operation uniqueness; synthetic chain adapters were used, with **zero financial transactions**. Mobile and desktop component checks exercise the sponsorship review and retained wallet confirmation. Production build and PWA lifecycle/release-shell checks passed.

**Base Sepolia live acceptance verified on 9 October 2026.** A real original Kernel v3.3 vault-creation receipt passed exact owner/calldata/event/block verification and was reconciled as confirmed, without sending a replacement transaction. Its owner operation had zero gas pricing and zero actual gas cost; the outer transaction was paid by a different bundler address. This corrects an overly narrow Alchemy-only/paymaster-required verifier. Private diagnostic evidence remains outside the public repository. Signed acceptance for Arbitrum Sepolia, Ethereum Sepolia, and Solana Devnet remains pending; custom Solana rent coverage is not established.

## Provider references

- [Privy gas sponsorship overview](https://docs.privy.io/wallets/gas-and-asset-management/gas/overview)
- [Privy setup and client SDK options](https://docs.privy.io/wallets/gas-and-asset-management/gas/setup)
- [Privy sponsored transaction lifecycle](https://docs.privy.io/wallets/gas-and-asset-management/gas/transaction-handling)
- [Alchemy 7702 transactions](https://www.alchemy.com/docs/wallets/transactions/using-eip-7702)
- [Canonical Alchemy deployments](https://github.com/alchemyplatform/modular-account/blob/v2.0.2/deployments/v2/Deployments.md)
- [Account execution source](https://github.com/alchemyplatform/modular-account/blob/v2.0.2/src/account/ModularAccountBase.sol)
- [EntryPoint v0.7 source](https://github.com/eth-infinitism/account-abstraction/blob/v0.7.0/contracts/core/EntryPoint.sol)

- [Kernel v3.3 account execution source](https://github.com/zerodevapp/kernel/blob/v3.3/src/Kernel.sol)
- [Kernel execution modes](https://github.com/zerodevapp/kernel/blob/v3.3/src/utils/ExecLib.sol)
