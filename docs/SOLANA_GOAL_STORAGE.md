# Solana programs, per-goal storage and rent

Checked 4 October 2026 against the active multichain source and public RPCs.

NabungFi does not deploy a new Solana program for each savings goal. The shared core program implements the vault lifecycle and the shared LayerZero transport handles authenticated messages. A new goal invokes `initialize` in the existing core program.

The initializer creates two accounts:

- Goal state PDA: seeds `["goal", owner, goal_id]`, owned by the core program. Allocation is `8 + Goal::INIT_SPACE = 824 bytes`, including capacity for three EVM participants.
- Cash USDC PDA: seeds `["usdc", goal_address]`, a 165-byte legacy SPL Token account. The goal PDA is its token authority.

Owner and goal ID make the accounts distinct for concurrent car/laptop/house goals. The program code is shared; target, balances, lifecycle and peer state stay isolated per goal. Both account initializations currently use `payer = owner`.

Source: [core initializer](../contracts/solana/programs/nabungfi-multi/src/lib.rs), [state allocation](../contracts/solana/programs/nabungfi-multi/src/state.rs). The public example goal `rqoDm4o8ovVgKnvBnCZ824RLKmZtDPLuHkHLCeQaQth` was also read from Devnet at slot 507317572: it exists, is owned by the active core `FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn`, and has 824 data bytes. This is a storage read, not a new financial transaction.

## Current storage reserve

`getMinimumBalanceForRentExemption` was queried for both sizes on `https://api.devnet.solana.com` and `https://api.mainnet-beta.solana.com`. Both returned the same values in this check:

| Account | Data bytes | Minimum lamports | SOL |
| --- | ---: | ---: | ---: |
| Goal state | 824 | 4,836,160 | 0.00483616 |
| Goal cash USDC | 165 | 1,488,440 | 0.00148844 |
| Two core goal accounts | 989 total | 6,324,600 | 0.00632460 |

These are current RPC observations, not fixed pricing or proof of a Mainnet deployment. The reserve is separate from transaction/priority fees, LayerZero message quotes, an owner token account that may need creation, and shared program/OApp deployment/configuration costs. Additional strategy accounts would also have their own storage requirements. Re-query the RPC when presenting a real setup quote rather than hardcoding a rent formula.

Solana describes this as a refundable minimum storage balance proportional to account size, rather than a recurring bill charged to each goal. See [Solana accounts](https://solana.com/docs/core/accounts), [PDA accounts](https://solana.com/docs/core/pda), and the [RPC rent method](https://solana.com/docs/rpc/http/getminimumbalanceforrentexemption). A PDA is an address, not a newly deployed program and not a private key.

## Current refund limitation

The active `nabungfi-multi` interface does not include a goal-close instruction or an SPL cash-account close CPI. A successful USDC claim does not currently return either account's SOL storage reserve to the owner. Do not present a full rent refund as implemented.

A future reclaim path must check terminal lifecycle, empty local USDC, absence of strategy positions, and completion of required peer work. It must preserve enough durable goal/sequence identity to reject recreation or delayed/replayed LayerZero messages. Keeping a compact terminal record may be safer than deleting all state. This document records the design constraint; no program, goal account or rent-reclaim operation was modified for the UI task.
