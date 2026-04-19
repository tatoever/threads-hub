-- 009: Threads @username を保存する列を追加
-- threads_user_id（数値）ではなく username（プロフィールURL用）を別途保持
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS threads_username TEXT;

COMMENT ON COLUMN accounts.threads_username IS 'Threads @username（https://www.threads.net/@<username> で使う）';

CREATE INDEX IF NOT EXISTS idx_accounts_threads_username ON accounts(threads_username) WHERE threads_username IS NOT NULL;
