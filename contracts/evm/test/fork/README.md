# USDC fork verification

Run from `contracts/evm` after copying `.env.example` to the ignored `.env` and installing the documented dependencies:

```bash
RUN_EVM_TESTNET_FORKS=true forge test --match-path 'test/fork/AaveTestnetFork.t.sol' --threads 1 -vv
RUN_BASE_FORK=true forge test --match-path 'test/fork/AaveBaseFork.t.sol' -vv
```

The first command requires explicit `*_FORK_BLOCK` pins and RPC, Circle USDC, legacy Aave pool/asset/aToken, Endpoint, and legacy router/factory variables. Missing configuration fails the opted-in suite. Without opt-in, tests are reported as **skipped**, not successful network execution.

The retained suite passed **15 testnet fork cases and 2 Base mainnet fork cases** with zero failures or skips when both opt-ins were enabled. The additional `LayerZeroConfigurationFork.t.sol` scenario pins Base Sepolia **47,500,917**, before public wiring, and locally runs explicit configuration, seal/create, actual worker quotes and cash lifecycle handlers. It injects authenticated callers and artificial USDC; its result is not public delivery evidence.

| Network | Snapshot block | Circle USDC cash custody | Aave strategy tested |
| --- | ---: | --- | --- |
| Base Sepolia | 47,495,063 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Legacy Aave test token `0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f` |
| Arbitrum Sepolia | 314,241,197 | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | Same Circle USDC |
| Ethereum Sepolia | 11,813,591 | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Legacy token `0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8`; supply is blocked by the actual reserve cap |

Circle addresses are listed in the [official contract registry](https://developers.circle.com/stablecoins/usdc-contract-addresses). Base and Ethereum Circle custody tests use the explicit cash-only vault configuration; they do not invent an Aave reserve or claim earning on an unsupported token.

The testnet suite checks deployed staging router/factory dependencies and the unsealed funding guard. Independent local vault tests check real USDC custody, early-claim rejection, progress/reserve separation, exact one-raw-unit deficit rejection, actual strategy receipt ownership, zero debt, minimum-output atomic rollback, receipt redemption, and claim conservation. Local command authentication is injected through `MockMessageTransport`, explicitly outside the LayerZero verification boundary.

One case per testnet executes the actual `DeployNabungFi.run()` entrypoint, using its normal `.env` loader, actual Endpoint and Circle token, and the configured deployer nonce. Only `TESTNET_CHAIN_ID` is selected for the case and restored afterward. This simulates local CREATE, then checks the router administrator, delegate registration in the real Endpoint, peer, factory dependencies, cash/earning profile, unsealed route, and zero goals. The snapshot deployer nonces are Base 28, Arbitrum 1, Ethereum 1; the configured expected nonce must match those pins. These tests record no signed or submitted network transaction. Run with `--threads 1` to isolate the temporary environment selection.

The Arbitrum sequencer RPC and PublicNode pruned some account state at the pin. The verified archive override `ARBITRUM_SEPOLIA_FORK_RPC_URL` in `.env.example` is `https://arbitrum-sepolia.gateway.tenderly.co`. Each network may supply `*_FORK_RPC_URL`; otherwise tests use its deployment `*_RPC_URL`. Use an archive-capable provider when replaying the snapshot.

For a 100 USDC position, measured local outcomes at these pins are:

| Actual Aave underlying | Immediate redeemed raw USDC | After one simulated day |
| --- | ---: | ---: |
| Base Sepolia legacy token | 99,999,998 | 100,000,702 |
| Arbitrum Sepolia Circle USDC | 100,000,000 | 100,011,759 |

Ethereum Sepolia's legacy market has a 2,000,000,000 USDC supply cap and receipt supply of 4,459,687,574.748968 USDC at the pin. Both 100 USDC and one-raw-unit supply attempts revert with Aave `51` ([`SUPPLY_CAP_EXCEEDED`](https://github.com/aave/aave-v3-core/blob/master/contracts/protocol/libraries/helpers/Errors.sol)). The test proves idle balances and allowance rollback remain correct and completion can use idle funds; it does **not** prove a working earning route for that market.

The two older Base mainnet tests retain block 51,893,120 and its measured rounding/accrual expectations.

All forks are read-only RPC snapshots. Initial token balances use `deal`, accrual uses `warp`, and command delivery is local. No wallet is signed, no transaction is broadcast and no public interest is earned by these checks. The [separate public cash lifecycle](../../../deployments/layerzero-solana-base-live.json) records actual LayerZero delivery and claims; neither evidence class proves a multi-EVM aggregate or live yield.
