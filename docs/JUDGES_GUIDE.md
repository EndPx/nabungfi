# Review NabungFi in five minutes

NabungFi turns a USDC savings goal into a 100-piece 3D build. Dedicated vaults keep each goal separate, a chosen target governs withdrawal, and confirmed savings fund visible pieces. Net earnings in the yield design contribute to the same goal accounting.

## 1. See the product

- **Live app:** https://nabungfi.endpx.cloud/app
- **Product demo, 2:37:** https://youtu.be/IL7THrY67Gk
- **Pitch:** https://youtu.be/RNPb-dib-tM
- **Documentation:** https://nabungfi.gitbook.io/nabungfi-docs/

The demo shows the deployed app and real testnet transactions. The pitch explains the problem, product and builder.

## 2. Try the savings journey

1. Sign in with Google or email. Privy prepares missing embedded EVM and Solana wallets. No shared credentials are required.
2. Open **Wallets** to see USDC and native token balances. Use **Faucets** to obtain testnet tokens; providers apply their own limits.
3. Create a car goal with a **10-USDC target**, selecting **Solana Devnet and Base Sepolia**. Confirm the goal lock before setup.
4. Review the Base vault and Solana initialization. Wait for both vaults to link before funding.
5. Deposit **5 USDC on Solana**. Assemble its funded pieces to see the 50-piece model and rotate it.
6. On Base, approve **exactly 5 USDC**, then review the separate **5-USDC deposit**. The allocation becomes 50% / 50%.
7. Prepare completion on Solana. Wait for every selected participant to verify the same goal. The final piece becomes available after achievement.
8. Claim available savings from both vaults. The finished build remains in the dashboard, and activity links to the original transactions.

Eligible embedded-wallet actions request testnet sponsorship. Review the actual fee and any account-creation funding shown in the wallet. External wallets use their own native gas balance.

The beta coordinator has a finite active-goal capacity; [API configuration and admission](../apps/server/README.md) describe it. If setup is unavailable, the recorded demo and public receipts remain inspectable. Message delivery is asynchronous. An interrupted wallet response should be recovered through its original request/hash before another operation is started.

## 3. Verify the recorded result

The [11 October demo evidence](DEMO_EVIDENCE.md) contains all eight confirmed owner transactions. Its new goal funded 5 + 5 USDC, reached verified completion, and returned 5 USDC from each vault. Both final vault balances were zero, while the completed 100-piece build remained visible.

The [four-network browser acceptance](BROWSER_E2E_ACCEPTANCE.md) separately records Solana, Base, Arbitrum and Ethereum execution. The [concurrent-goal runbook](CONCURRENT_GOALS_RUNBOOK.md) demonstrates that one goal can complete while other goals remain independently locked.

## 4. Find the implementation

| Inspect | Start here |
| --- | --- |
| Consumer experience and wallet reviews | [Web application](../apps/web/README.md) |
| Owner-scoped API, plans and receipt validation | [Authenticated server](../apps/server/README.md) |
| Exact USDC accounting and lifecycle model | [Shared package](../shared/README.md) |
| Goal coordinator and Solana custody | [Solana programs](../contracts/solana/README.md) |
| EVM vaults, factories and Aave adapter | [EVM contracts](../contracts/evm/README.md) |
| State-derived coordination and recovery | [Permissionless keeper](../contracts/keeper/README.md) |
| Transport configuration and public execution | [LayerZero integration](LAYERZERO_INTEGRATION.md) |

## Release scope

The submitted application is a cash-vault testnet release. Aave adapter and retained Kamino strategy work are present in the repository; the recorded public browser lifecycle does not establish realized yield. Mainnet execution, independent audit assurance and measured user-retention outcomes are outside this acceptance. The [verification history](EVIDENCE_HISTORY.md) preserves the dated evidence and its boundaries.
