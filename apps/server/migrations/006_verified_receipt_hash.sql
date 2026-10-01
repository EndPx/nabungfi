-- A public hash is not proof of ownership: tentative observations cannot occupy another owner's receipt.
DROP INDEX nabungfi.goal_steps_original_transaction;
CREATE UNIQUE INDEX goal_steps_owner_original_transaction ON nabungfi.goal_steps(owner_id,network,transaction_hash) WHERE transaction_hash IS NOT NULL;
CREATE UNIQUE INDEX goal_steps_verified_transaction ON nabungfi.goal_steps(network,transaction_hash)
WHERE transaction_hash IS NOT NULL AND status IN ('confirmed','failed');
CREATE FUNCTION nabungfi.guard_verified_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('confirmed','failed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'VERIFIED_RECEIPT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_verified_receipt BEFORE UPDATE ON nabungfi.goal_steps FOR EACH ROW EXECUTE FUNCTION nabungfi.guard_verified_receipt();
