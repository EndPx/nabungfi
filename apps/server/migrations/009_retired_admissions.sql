-- Only the private worker's verified completion IDs retire operational slots; history remains stored.
ALTER TABLE nabungfi.operator_admissions ADD COLUMN retired boolean NOT NULL DEFAULT false;
CREATE FUNCTION nabungfi.guard_retired_admission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.retired AND NOT NEW.retired THEN RAISE EXCEPTION 'RETIRED_ADMISSION_IMMUTABLE'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_retired_admission BEFORE UPDATE ON nabungfi.operator_admissions FOR EACH ROW EXECUTE FUNCTION nabungfi.guard_retired_admission();
