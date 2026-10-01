-- Preserve immutable participants while allowing only actual receipt bindings to be added.
CREATE FUNCTION nabungfi.guard_goal_participants() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_part jsonb; new_part jsonb; i integer;
BEGIN
  IF NEW.binding->'version' IS DISTINCT FROM OLD.binding->'version'
    OR NEW.binding->'profile' IS DISTINCT FROM OLD.binding->'profile'
    OR jsonb_array_length(NEW.binding->'participants') IS DISTINCT FROM jsonb_array_length(OLD.binding->'participants') THEN
    RAISE EXCEPTION 'IMMUTABLE_GOAL_PARTICIPANTS';
  END IF;
  FOR i IN 0..jsonb_array_length(OLD.binding->'participants')-1 LOOP
    old_part := OLD.binding->'participants'->i;
    new_part := NEW.binding->'participants'->i;
    IF (new_part - 'vault' - 'configHash' - 'creationHash') IS DISTINCT FROM (old_part - 'vault' - 'configHash' - 'creationHash')
      OR (old_part ? 'vault' AND new_part->'vault' IS DISTINCT FROM old_part->'vault')
      OR (old_part ? 'configHash' AND new_part->'configHash' IS DISTINCT FROM old_part->'configHash')
      OR (old_part ? 'creationHash' AND new_part->'creationHash' IS DISTINCT FROM old_part->'creationHash') THEN
      RAISE EXCEPTION 'IMMUTABLE_GOAL_PARTICIPANTS';
    END IF;
  END LOOP;
  IF OLD.binding->>'initialized'='true' AND NEW.binding->>'initialized' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'INITIALIZATION_IRREVERSIBLE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_goal_participants BEFORE UPDATE ON nabungfi.goals FOR EACH ROW EXECUTE FUNCTION nabungfi.guard_goal_participants();
