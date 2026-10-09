---
description: "Wallet cash, native gas and goal vault assets are distinct balances."
---

# Wallets and Faucets

Wallets shows linked account addresses and directly reads their token balances. USDC is the savings asset. SOL on Solana and ETH on EVM networks are native gas tokens. The EVM address can be identical across three networks while every balance is different.

Use Refresh balances to request a fresh read. The page also polls while visible and online. Failed network reads show unavailable instead of a fabricated zero. Small native balances are never rounded into a false zero; compact approximate values retain the complete amount in the accessible label and tooltip.

## Fund the network you will use

Faucets has one card per supported network with a verified destination address and separate USDC/gas actions. Circle provides the linked USDC faucet. The configured gas links are Solana Foundation for SOL, thirdweb for Base/Arbitrum Sepolia ETH, and Google Cloud for Ethereum Sepolia ETH. These links can require provider sign-in, eligibility or request limits.

The app opens a provider; it does not guarantee a faucet claim or transfer funds between chains. Prefer the current in-app provider links to a copied old URL.

## Inspect addresses

Wallet addresses link to their network explorers. The EVM explorer selector lets the user choose the intended network. Goal details separately show each vault address; the Solana cash address is a token account controlled by the goal state PDA, not the user’s spendable wallet.

Adding an external wallet to a session and linking one for future sign-ins are separate options. Neither changes an existing goal’s immutable owner binding. An eligible embedded-wallet sponsor request can pay a network fee while the owner’s native balance is zero, but it still needs wallet confirmation and does not mint USDC.
