CREATE TABLE nabungfi.users (
  id uuid PRIMARY KEY,
  privy_subject text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nabungfi.goals (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES nabungfi.users(id),
  goal_id text UNIQUE NOT NULL CHECK(goal_id ~ '^0x[0-9a-f]{64}$'),
  name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 100),
  model text NOT NULL CHECK(model IN ('car','laptop','house','custom')),
  target_raw numeric(20,0) NOT NULL CHECK(target_raw > 0 AND target_raw <= 18446744073709551615),
  binding jsonb NOT NULL,
  create_request_id text NOT NULL,
  create_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,create_request_id),
  UNIQUE(id,owner_id)
);

CREATE TABLE nabungfi.goal_steps (
  id uuid PRIMARY KEY,
  goal_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  request_id text NOT NULL,
  intent_fingerprint text NOT NULL,
  action text NOT NULL CHECK(action IN ('create-vault','initialize','approve','deposit','prepare','abort','claim')),
  network text NOT NULL CHECK(network IN ('solana','base','arbitrum','ethereum')),
  amount_raw numeric(20,0) CHECK(amount_raw > 0 AND amount_raw <= 18446744073709551615),
  status text NOT NULL CHECK(status IN ('planning','planned','submitted','pending','confirmed','failed','attention')),
  plan jsonb,
  transaction_hash text,
  receipt jsonb,
  reason_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(goal_id,owner_id) REFERENCES nabungfi.goals(id,owner_id),
  UNIQUE(goal_id,owner_id,request_id)
);
CREATE UNIQUE INDEX goal_steps_original_transaction ON nabungfi.goal_steps(network,transaction_hash) WHERE transaction_hash IS NOT NULL;
CREATE INDEX goals_owner_created ON nabungfi.goals(owner_id,created_at DESC);
CREATE INDEX goal_steps_owner_goal_created ON nabungfi.goal_steps(owner_id,goal_id,created_at DESC);

CREATE FUNCTION nabungfi.guard_goal_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_id<>OLD.owner_id OR NEW.goal_id<>OLD.goal_id OR NEW.target_raw<>OLD.target_raw
    OR NEW.binding->'owner' IS DISTINCT FROM OLD.binding->'owner'
    OR NEW.binding->'goalId' IS DISTINCT FROM OLD.binding->'goalId'
    OR NEW.binding->'targetRaw' IS DISTINCT FROM OLD.binding->'targetRaw'
    OR NEW.binding->'solanaGoal' IS DISTINCT FROM OLD.binding->'solanaGoal'
    OR NEW.binding->'solanaCash' IS DISTINCT FROM OLD.binding->'solanaCash' THEN
    RAISE EXCEPTION 'IMMUTABLE_GOAL_IDENTITY';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_goal_identity BEFORE UPDATE ON nabungfi.goals FOR EACH ROW EXECUTE FUNCTION nabungfi.guard_goal_identity();

CREATE FUNCTION nabungfi.guard_original_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.transaction_hash IS NOT NULL AND NEW.transaction_hash IS DISTINCT FROM OLD.transaction_hash THEN
    RAISE EXCEPTION 'ORIGINAL_TRANSACTION_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_original_transaction BEFORE UPDATE ON nabungfi.goal_steps FOR EACH ROW EXECUTE FUNCTION nabungfi.guard_original_transaction();
