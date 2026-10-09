---
description: "From a named goal to verified completion and chain-local collection."
---

# Overview

A NabungFi goal connects an offchain name and model with an immutable onchain savings binding. The owner creates and funds that goal, while the API verifies receipts and the keeper delivers state-derived coordination messages.

![NabungFi journey](../assets/journey.png)

## The complete journey

```mermaid
flowchart TB
  SignIn["Sign in and prepare wallets"] --> Create["Create a goal and choose networks"]
  Create --> Setup["Create vaults and initialize Solana"]
  Setup --> Link["Verify every selected participant"]
  Link --> Save["Deposit USDC into local vaults"]
  Save --> Target{"Goal-local target funded?"}
  Target -->|"No"| Save
  Target -->|"Yes, with current reports"| Prepare["Owner requests completion"]
  Prepare --> Verify["All selected vaults verify reserves"]
  Verify --> Complete["Achievement and completion messages"]
  Complete --> Claim["Owner claims each chain’s available USDC"]
  Claim --> History["Collected build stays in Dashboard"]
```

Money and messages follow different paths. A deposit goes from the owner’s wallet into that chain’s vault. A LayerZero packet communicates state to another participant. A claim returns USDC from the local vault to its owner; it does not automatically consolidate funds into one wallet on another network.

| Stage | Detail |
| --- | --- |
| Define the commitment | [Goal Creation](goal-creation.md) |
| Bind and register participants | [Vault Setup](vault-setup.md) |
| Add money and show progress | [Deposits and Build Progress](deposits-and-progress.md) |
| Establish achievement | [Completion and Cancellation](completion.md) |
| Receive funds and retain history | [Claims and Accounting](claims.md) |
| Resolve uncertain responses | [Transaction Recovery](recovery.md) |
