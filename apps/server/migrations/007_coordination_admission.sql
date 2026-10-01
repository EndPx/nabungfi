-- Admission reserves operator capacity before an owner pays any provisioning fee.
CREATE TABLE nabungfi.operator_admissions (
  goal_id text PRIMARY KEY REFERENCES nabungfi.goals(goal_id),
  admitted_at timestamptz NOT NULL DEFAULT now()
);
