ALTER TABLE nabungfi.goal_steps DROP CONSTRAINT goal_steps_status_check;
ALTER TABLE nabungfi.goal_steps ADD CONSTRAINT goal_steps_status_check CHECK(status IN ('planning','planned','signing','submitted','pending','confirmed','failed','attention'));
CREATE FUNCTION nabungfi.guard_step_intent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_id<>OLD.owner_id OR NEW.goal_id<>OLD.goal_id OR NEW.request_id<>OLD.request_id
    OR NEW.intent_fingerprint<>OLD.intent_fingerprint OR NEW.action<>OLD.action OR NEW.network<>OLD.network
    OR NEW.amount_raw IS DISTINCT FROM OLD.amount_raw THEN
    RAISE EXCEPTION 'IMMUTABLE_STEP_INTENT';
  END IF;
  IF OLD.plan IS NOT NULL AND NEW.plan IS DISTINCT FROM OLD.plan
    AND (OLD.status<>'planned' OR NEW.status<>'planned' OR OLD.transaction_hash IS NOT NULL) THEN
    RAISE EXCEPTION 'ORIGINAL_PLAN_IMMUTABLE';
  END IF;
  IF OLD.status='signing' AND NEW.status IN ('planned','planning') THEN
    RAISE EXCEPTION 'WALLET_OUTCOME_UNKNOWN';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_step_intent BEFORE UPDATE ON nabungfi.goal_steps FOR EACH ROW EXECUTE FUNCTION nabungfi.guard_step_intent();
