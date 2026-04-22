-- 管理者ブラウザの計測除外リスト
-- 公開ドメイン (note-sub.top) 側で閲覧・登録可能にする。認証は device_id (クライアント生成UUID)で担保
CREATE TABLE IF NOT EXISTS tracker_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  label text,
  user_agent text,
  platform text,
  timezone text,
  language text,
  screen_size text,
  is_active boolean NOT NULL DEFAULT true,
  excluded_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tracker_exclusions_active ON tracker_exclusions(is_active);
CREATE INDEX IF NOT EXISTS idx_tracker_exclusions_device ON tracker_exclusions(device_id);

-- RLS は service role key 経由の API でのみ操作するので無効のまま（public table だがapiでのみ書込）
-- 必要ならば anon role に select を許可
