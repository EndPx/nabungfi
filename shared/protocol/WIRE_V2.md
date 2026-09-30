# NabungFi multichain wire v2

`wire-v2.json` is a common Solidity/Rust golden fixture. It is illustrative data, not deployed routers/vaults or public transaction evidence. V1 retains its own codec, fixture and deployment history.

V2 keeps the v1 fixed **222-byte** layout with version byte **2**. Numeric packet fields are big-endian. Source/destination application domains are Solana1, Base2, Arbitrum3 and Ethereum4; these are distinct from chain IDs and LayerZero EIDs. The 32-byte owner field at offset142 is named **evmOwner** (Rust `evm_owner`), rather than a Base-only owner.

Kind values remain PREPARE1, COMMIT2, ABORT3, READY4, ABORT_ACK5, PROGRESS6, REGISTER7, REGISTERED8. Solana-origin kinds target exactly one EVM domain; EVM reports targetSolana. Each destination also validates authenticated origin EID/router/Store and its goal's participant identity. Reusing an EVM address on a different chain is allowed; swapping the authenticated domain/EID is not.

Per-participant SHA256 configuration commitments use the exact preimage in [multichain v2 plan](../../docs/MULTICHAIN_V2_PLAN.md). The target, application domain and EID are little-endian in that commitment, unlike packet numbers. Three literal preimages and hashes pin Base/Arbitrum/Ethereum identities independently. The example COMMIT targets Arbitrum, with a2-USDC localreserve and10-USDC aggregate.

Separate per-peer lifecycle/progress counters prevent a report from one chain skipping another chain's READY. Solana requires every registered participant's realized reserve in the same completion round, including zero-balance participants. Progress snapshots never authorize claims. The authenticated Solana coordinator certifies aggregate reserves; an EVM vault does not independently prove the balances of other chains.
