-- ============================================================
-- Per-account Meta App credentials
-- Each account uses its own Meta Developer App for BAN isolation
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN threads_app_id TEXT,
  ADD COLUMN threads_app_secret TEXT;

COMMENT ON COLUMN accounts.threads_app_id IS 'Meta Developer App ID (per-account for BAN isolation)';
COMMENT ON COLUMN accounts.threads_app_secret IS 'Meta Developer App Secret (per-account for BAN isolation)';
