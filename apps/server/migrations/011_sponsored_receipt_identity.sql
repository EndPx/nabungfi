-- ERC-4337 bundles can contain independent owners. Each verified operation is unique globally;
-- direct EVM/Solana receipts retain their original transaction-hash uniqueness.
DROP INDEX nabungfi.goal_steps_verified_transaction;
CREATE UNIQUE INDEX goal_steps_verified_transaction ON nabungfi.goal_steps(network,COALESCE(receipt->>'userOperationHash',transaction_hash))
WHERE transaction_hash IS NOT NULL AND status IN ('confirmed','failed');
ALTER TABLE nabungfi.goal_steps ADD CONSTRAINT sponsored_terminal_operation_required CHECK (
  NOT (plan->>'gasPayment' = 'privy-testnet' AND network <> 'solana' AND status IN ('confirmed','failed') AND transaction_hash IS NOT NULL)
  OR (receipt->>'userOperationHash' ~ '^0x[0-9a-f]{64}$') IS TRUE
);
