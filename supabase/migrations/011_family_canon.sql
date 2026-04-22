-- account_personas に family_canon を追加
-- 目的: キャラクターの家族構成（配偶者・子）を生年月日ベースで canonicalize し、
--       投稿生成時に年齢・学齢・語彙ガードを動的注入できるようにする。
--
-- スキーマ:
-- {
--   "era_mode": "real_time_with_flashback" | "flashback_only" | "real_time_only",
--   "family": { ... 人物ごとに birth_date + traits ... },
--   "vocabulary_guards": {
--     "allowed_now": [...],
--     "forbidden_until_YYYY_MM": [...],
--     "transition_dates": { "YYYY-MM-DD": "説明" }
--   },
--   "era_policy": { "default": "...", "flashback_ok": "...", "future": "..." }
-- }

ALTER TABLE account_personas
  ADD COLUMN IF NOT EXISTS family_canon JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN account_personas.family_canon IS
  '家族canon: 生年月日ベースの年齢計算と語彙ガードを pipeline prompt に動的注入する';
