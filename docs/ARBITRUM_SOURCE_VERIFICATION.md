# Arbitrum source correspondence and explorer queue

Checked 1 October 2026. The original v2 Arbitrum router, factory and completed demonstration vault have **Sourcify exact matches for both creation and runtime bytecode**. Their original Etherscan submissions still report `Pending in queue`; that provider-specific state is preserved separately. [Machine-readable evidence](../contracts/deployments/multichain/arbitrum-source-verification.json).

| Component | Address | Sourcify result |
| --- | --- | --- |
| Router | `0xd524e3d9e7f0b419a862b4ad854422d573b5d651` | [Exact creation/runtime match](https://repo.sourcify.dev/421614/0xd524e3d9e7f0b419a862b4ad854422d573b5d651) |
| Factory | `0x20a585751c48d4341c27cc0d91bd4ed6b621626f` | [Exact creation/runtime match](https://repo.sourcify.dev/421614/0x20a585751c48d4341c27cc0d91bd4ed6b621626f) |
| Original completed vault | `0x0bd119e1ff26b98a8cf5be374432bbd705d3edd6` | [Exact creation/runtime match](https://repo.sourcify.dev/421614/0x0bd119e1ff26b98a8cf5be374432bbd705d3edd6) |

These matches already completed on 30 September through the original Sourcify jobs. This investigation did not submit replacements or send onchain transactions.

## Independent checks

The verification records use Solidity `0.8.30+commit.73712a01`, optimizer enabled with 200 runs, `cancun`, and `viaIR=false`. The public compiler standard JSON was downloaded and independently recompiled with that pinned compiler. Both unbound compiler outputs matched the verifier's outputs. Applying the recorded immutable replacements produced the exact current RPC runtime; appending the recorded constructor arguments produced the exact deployment creation bytecode. Router/factory runtime hashes also matched their original deployment manifests.

| Component | Current RPC runtime Keccak256 |
| --- | --- |
| Router | `0x4dbed7514aeaa4244070fe8ab820fc2731ac6820e2deb30105476e8130c302f8` |
| Factory | `0x1e3321bfe5d1f878afe868c3985cf29916ece1b01c8fde072a86d3edd99d721e` |
| Original vault | `0x41a840c4d03a001a006c393f6d75094c8a3bd093d3749a3a0698dd91d8cdf9e5` |

The evidence JSON pins creation hashes, standard-JSON snapshot hashes, original jobs, creation transactions, match IDs and verification timestamps. These are original v2 deployments. V1 historical source remains pinned to commit `b64280b28ea771fa8c53beae8e8f061d7651e46a`; current source/metadata must not be equated to the historical v1 binaries.

## Reproduce through public data

1. Fetch `https://sourcify.dev/server/v2/contract/421614/<address>?fields=all` for each address. Verify `creationMatch` and `runtimeMatch` are `exact_match`, and inspect `compilation`, `stdJsonInput`, bytecode transformations and deployment metadata. The [official Sourcify API](https://docs.sourcify.dev/docs/api/) documents this public lookup and job-status endpoint.
2. Recompile `stdJsonInput` using the exact recorded solc version/settings. Add only an `outputSelection` for `evm.bytecode.object` and `evm.deployedBytecode.object` if absent; do not flatten sources or alter optimizer, EVM, remapping or metadata settings.
3. Compare unbound bytecode, substitute each recorded immutable value at its exact offset, and append the recorded constructor arguments. Compare against the verifier's onchain creation/runtime data and current `eth_getCode` on Arbitrum Sepolia. Hash the runtime and compare to the table/evidence JSON.
4. Query each original Etherscan GUID with chain ID `421614` using a locally held API key. Do not expose the key or a URL containing it. [Etherscan's status endpoint](https://docs.etherscan.io/api-reference/endpoint/checkverifystatus) documents preserving the original GUID; a pending response is not a successful source-verification result.

## Queue investigation and limits

Etherscan's current chain list identifies chain `421614`, the `sepolia.arbiscan.io` explorer and the V2 endpoint as active. The original router/factory/vault GUIDs and a separate factory propagation GUID all still returned `Pending in queue`, without source present through Etherscan. This is not explained by a wrong chain ID or unsupported source/ABI tier; [Etherscan documents source/ABI availability on all chains](https://docs.etherscan.io/supported-chains).

The completed Sourcify job logs record Etherscan external-propagation rate-limit errors for the router/vault and Blockscout HTTP 429 errors. The factory propagation was accepted with its own GUID, which is also preserved. Those observed errors do **not** establish the cause of the original Etherscan queue; public responses do not reveal it. No pending Etherscan request was resubmitted merely because time elapsed.

Sourcify exact source/creation/runtime correspondence is terminal and independently reproduced. An Arbiscan source badge remains a separate pending provider outcome. Neither source verification nor this comparison is an audit, a liquidity guarantee, or evidence of additional savings operations.
