-- One signed/unknown wallet outcome per authenticated owner/network, across all their goals.
DROP INDEX nabungfi.goal_steps_active_wallet_lane;
CREATE UNIQUE INDEX goal_steps_active_wallet_lane ON nabungfi.goal_steps(owner_id,network)
WHERE plan IS NOT NULL AND status IN ('signing','submitted','pending','attention');
