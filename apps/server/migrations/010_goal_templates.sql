ALTER TABLE nabungfi.goals DROP CONSTRAINT goals_model_check;
ALTER TABLE nabungfi.goals ADD CONSTRAINT goals_model_check
  CHECK (model IN ('car','laptop','house','custom','console','camera','motorcycle','bicycle','phone','travel'));
