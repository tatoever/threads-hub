-- Ensure pipeline_runs has a unique key on (account_id, date, phase)
-- so that upsert(..., { onConflict: 'account_id,date,phase' }) works correctly.
--
-- Without this constraint, Supabase's upsert falls back to INSERT and fails
-- when a row already exists, causing pipeline handlers to skip writing results.

ALTER TABLE pipeline_runs
  ADD CONSTRAINT pipeline_runs_account_date_phase_unique
  UNIQUE (account_id, date, phase);
