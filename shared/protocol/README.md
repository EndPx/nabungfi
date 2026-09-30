# NabungFi wire protocol v1

The same fixture is consumed by Solidity and Rust tests. Native instruction serialization may use ABI/Borsh; the crosschain packet is exactly **222 bytes**, with big-endian numeric fields and no trailing data.

| Offset | Bytes | Field |
| --- | --- | --- |
| 0 | 4 | Magic `NBFG` |
| 4 | 1 | Version = 1 |
| 5 | 1 | Message kind |
| 6 | 4 | Source application domain |
| 10 | 4 | Destination application domain |
| 14 | 32 | Goal ID |
| 46 | 32 | Configuration hash |
| 78 | 32 | Source vault/coordinator |
| 110 | 32 | Destination vault/coordinator |
| 142 | 32 | Base owner |
| 174 | 8 | Completion round |
| 182 | 8 | Per-goal application sequence |
| 190 | 8 | Amount |
| 198 | 8 | Aggregate reserved amount |
| 206 | 8 | Source observation block/slot |
| 214 | 8 | Source observation timestamp |

Kinds: PREPARE=1, COMMIT=2, ABORT=3, READY=4, ABORT_ACK=5, PROGRESS=6, REGISTER=7, REGISTERED=8. Solana sends 1/2/3/7; Base sends 4/5/6/8. Application domains are 1/2, distinct from LayerZero endpoint IDs. EVM identities are 12 zero bytes plus a nonzero 20-byte address. Amounts are checked u64 raw USDC units (six decimals).

Registration has round/sequence zero and carries the positive target. Progress has round zero and a positive progress sequence. Other lifecycle packets require a positive round/sequence. Only COMMIT carries a nonzero aggregate. PREPARE/ABORT/ABORT_ACK carry zero amount. READY may report a genuine zero local reserve. Observation references/timestamps must be nonzero.

The configuration commitment deliberately matches the core's existing SHA-256 preimage, with **little-endian target/application-domain fields**. This differs from the wire packet's big-endian fields. `wire-v1.json` pins both encodings independently; changing either requires an explicit protocol version and coordinated peer update.

Fixture addresses are illustrative protocol inputs, not deployment addresses or network receipts. [Integration evidence and trust boundaries](../../docs/LAYERZERO_INTEGRATION.md).
