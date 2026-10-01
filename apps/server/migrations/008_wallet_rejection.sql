-- Explicit owner attestation of provider 4001 is not an onchain receipt.
ALTER TABLE nabungfi.goal_steps DROP CONSTRAINT goal_steps_status_check;
ALTER TABLE nabungfi.goal_steps ADD CONSTRAINT goal_steps_status_check CHECK(status IN ('planning','planned','signing','submitted','pending','confirmed','failed','attention','rejected'));
CREATE FUNCTION nabungfi.guard_wallet_rejection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='rejected' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.receipt IS DISTINCT FROM OLD.receipt) THEN
    RAISE EXCEPTION 'WALLET_REJECTION_TERMINAL';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_wallet_rejection BEFORE UPDATE ON nabungfi.goal_steps FOR EACH ROW EXECUTE FUNCTION nabungfi.guard_wallet_rejection();
