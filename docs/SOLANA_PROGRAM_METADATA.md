# Solana program interfaces and explorer decoding

On 2026-10-07, NabungFi published interfaces for both current v2 programs on **Solana Devnet**. An existing successful owner transaction that previously showed `Unknown Program: Unknown Instruction` now displays **`NabungfiMulti: Claim`** in Solana Explorer, including its six named accounts and the `amount` argument `280000` (0.28 USDC). The transaction was not resubmitted.

- [Original owner claim](https://explorer.solana.com/tx/3NdYnAnbhptq9hd4ENrZHQtRqcDFo56rwSXPLS9To1dN7LsRLAZJNmycSHpEtjKzBxpErEfrAWT1VFPLrHBouum8?cluster=devnet): successful, finalized, vault cash decreased by 0.28 USDC and the owner's USDC increased by the same amount.
- [Public publication receipts](../contracts/deployments/solana-metadata/program-interfaces-2026-10-07.json): **21 finalized metadata transactions**. These are separate from the earlier LayerZero lifecycle messages.
- Exact readback matched the committed Anchor IDLs and PMP Codama/security files. Both IDL resolver endpoints returned HTTP 200 with `type: pmp` and a valid IDL.
- Live program bytecode hashes, deployment slots, program IDs and upgrade authorities stayed unchanged. The signer balance decrease for metadata storage and transaction fees was **83,651,020 lamports (0.08365102 Devnet SOL)**.

IDL publication provides an interface for decoding. It is not a security audit or a reproducible-build verification badge. This verification covered Solana Explorer; other explorers choose their own indexing and decoding support.

## Published identities

| Field | Savings core | LayerZero transport |
|---|---|---|
| Program | `FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn` | `G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d` |
| Anchor IDL account | `6FvK53TBkRN8RNDtcMJ6ETAa2TFoPjpV1qbNzqKE38uQ` | `Dpt6vBQ9L3tcKw1sWtzqWrVJycVcNCTo7Qcp62uqt6m6` |
| Canonical PMP IDL | `3Y1NrkwZxwszNFUqujPq8M6izb7JpLHxWYHoKoy3TK7u` | `6A6jsouzs7L8wmeXmbKBodYqawfurVCyRsCnZXgdFEtT` |
| Canonical PMP security metadata | `BvAPx7DwdrqX8KcJtvAKg7wYGbCiq5eEo7JcyfKoSAFX` | `6PE43gs1EBsLLAsAFfmUHQYzJNdeB7ZgcH3JeKJ3pWXq` |
| Security metadata name | NabungFi Savings Core | NabungFi LayerZero Transport |
| Unchanged deployment slot | `505952225` | `505957652` |

The PMP program is `ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S`. The original program upgrade authority, Anchor IDL authority and publishing signer is `AMoZFFdhUaNq8qyVRE4RrdW7rBc5Jssc6b7MyERMB7s8`.

Committed interfaces are in [contracts/solana/idl](../contracts/solana/idl). Each program has an Anchor `.json`, a Codama `.codama.json` and public `.security.json`. Security metadata contains the project name, public website/repository/issues contact and logo; it contains no private contact or fictitious audit information.

## Generation and validation

The interfaces were generated from the Rust source with **Anchor 0.32.1** and **anchor-lang-idl 0.1.4**, using the program workspace's locked dependency graph. Each program exposes eight instructions. **@codama/nodes-from-anchor 1.5.6** and **codama 1.11.0** converted the generated Anchor interfaces to Codama.

The savings core uses Anchor account resolution. The transport uses `IdlBuilder::resolution(false)` because the pinned Endpoint interface's account-resolution macro references sibling `send_library_config` fields out of scope during IDL generation. Disabling automatic account resolution still generates instruction account order, signer/writable flags, argument types, discriminators, account types and errors. Clients must supply transport accounts explicitly; this setting does not change program execution.

Validation checked all instruction discriminators, decoded the original claim's amount, and decoded the associated `Goal` account with its actual owner. The transport IDL also decoded a previously successful [LayerZero `lz_receive` transaction](https://explorer.solana.com/tx/28AXMqARCEpU2kJk8fnknvUZ1nJcPcer4W2QetDY6Eyz8SwpBnFt4wAUFihqXUMKUQNMEXN4S6jnqQ2GCpixsFga?cluster=devnet). After publication, onchain Anchor payloads and resolver PMP payloads were compared to the public files, and every original publication signature was reconciled.

Run regeneration from the repository root with native Rust installed. The standalone builder avoids requiring an Anchor CLI installation or Docker. Use an ignored target directory for its build output:

```powershell
$env:CARGO_TARGET_DIR = Join-Path (Get-Location) '.local/idl-target-win'
cargo run --locked --manifest-path contracts/solana/script/idl-builder/Cargo.toml -- contracts/solana/programs/nabungfi-multi nabungfi-multi contracts/solana/idl/nabungfi_multi.json
cargo run --locked --manifest-path contracts/solana/script/idl-builder/Cargo.toml -- contracts/solana/programs/nabungfi-multi-lz nabungfi-multi-lz contracts/solana/idl/nabungfi_multi_lz.json
npm install --prefix .local/metadata-tooling --save-exact @solana-program/program-metadata@0.10.0 @codama/nodes-from-anchor@1.5.6 codama@1.11.0
node contracts/solana/script/convert-program-idls.mjs
```

Regeneration writes local files only. Review the diff and validate against the deployed ABI before any new publication.

## Publication procedure

`publish-program-interfaces.mjs` is restricted to the two documented Devnet programs and the Devnet genesis hash. It requires the original authority signer and saved matching deployment artifacts in `contracts/solana/target/deploy-multichain`. It checks the live executable bytes against those artifacts before processing metadata. Keep private keypairs, transaction journals and CLI exports outside Git.

Its default mode plans publication without sending transactions. It simulates creation of missing Anchor IDL accounts and freezes the official PMP CLI's unsigned transaction exports. `--broadcast` requires an existing plan whose signer and six file hashes still match. The publisher limits metadata rent to 250,000,000 lamports, validates exported programs/writable accounts, and submits through the existing journal with simulation, original-signature reconciliation and unresolved-operation protection.

```powershell
node contracts/solana/script/publish-program-interfaces.mjs --signer <authority-keypair-path> --metadata-cli .local/metadata-tooling/node_modules/@solana-program/program-metadata/bin/cli.cjs
```

For an explicitly authorized publication, append `--broadcast` to that reviewed command. Reuse the original journal to reconcile an interrupted publication; do not delete the journal or replace unresolved signatures. The publisher refuses an existing Anchor IDL with a different authority or payload and does not upgrade program code, change authorities, or perform savings actions. Updating a different existing interface requires a separately reviewed workflow.

Read-only resolver checks:

- [Core IDL](https://idl-one.vercel.app/api/idl?programId=FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn&cluster=devnet)
- [Transport IDL](https://idl-one.vercel.app/api/idl?programId=G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d&cluster=devnet)
- [Core program metadata](https://idl-one.vercel.app/api/security-txt?programId=FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn&cluster=devnet)
- [Transport program metadata](https://idl-one.vercel.app/api/security-txt?programId=G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d&cluster=devnet)

References: [Solana IDL documentation](https://solana.com/docs/programs/idls), [IDL Explorer API](https://idl.solana.com/docs), [official Program Metadata tooling](https://github.com/solana-program/program-metadata), and [Anchor 0.32.1 CLI source](https://github.com/coral-xyz/anchor/blob/v0.32.1/cli/src/lib.rs).
