-- 006_account_profile_display.sql
-- アカウント一覧カードをThreadsアカウントページ風にするための表示用カラム追加
-- - profile_picture_url: Threads Graph API から取得したプロフィール画像URL
-- - profile_bio: Threadsバイオテキスト（改行含む）
-- - profile_synced_at: 最終同期時刻

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_bio TEXT,
  ADD COLUMN IF NOT EXISTS profile_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN accounts.profile_picture_url IS 'Threads Graph API から取得したプロフィール画像URL';
COMMENT ON COLUMN accounts.profile_bio IS 'Threadsバイオ（自己紹介）テキスト';
COMMENT ON COLUMN accounts.profile_synced_at IS 'プロフィール最終同期時刻';
