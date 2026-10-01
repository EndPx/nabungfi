-- A different request UUID must not bypass reconciliation of a wallet outcome.
CREATE UNIQUE INDEX goal_steps_active_wallet_lane ON nabungfi.goal_steps(goal_id,action,network)
WHERE plan IS NOT NULL AND status IN ('signing','submitted','pending','attention');
