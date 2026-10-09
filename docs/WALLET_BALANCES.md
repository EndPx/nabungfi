# Linked wallet balances

`GET /api/wallet-balances` requires the existing Privy bearer session and returns `{ balances: WalletBalanceDTO[] }`. Wallet addresses come only from authoritative linked accounts; callers cannot select another address. No goal is required.

Each row contains `network`, `address`, `status`, `usdcRaw`, `nativeRaw` and `observedAt`. Available amounts are nonnegative atomic decimal strings: USDC has six decimals, SOL nine and ETH eighteen. Unavailable rows contain null amounts. A missing canonical Solana USDC token account means verified zero. An invalid mint, authority, genesis, EVM chain ID or RPC result is unavailable. One unavailable network does not discard other networks' results. EVM token and gas reads use the same block.

The endpoint is read-only and no-store. Concurrent identical reads coalesce only while in flight, without a settled financial cache. PWA caching excludes authenticated API responses. Wallets refreshes on entry, explicit refresh and a visible online thirty-second poll, with one client read in flight. Identity changes invalidate earlier results. Wallet cash is separate from goal vault savings.

Validation: independent native/token amounts, missing account and partial failure handling, HTTP authentication and caller-address rejection, mobile reflow, exact small balances, offline presentation and refresh are covered by the wallet balance tests. Public live RPC verification is recorded privately; fixture screenshots are examples, not claims of wallet transactions.
