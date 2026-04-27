-- 朝の健康診断サマリー
-- 毎朝 JST 07:00 に /api/cron/morning-health が1レコード生成
CREATE TABLE IF NOT EXISTS daily_health_summaries (
  date date PRIMARY KEY,
  overall text NOT NULL CHECK (overall IN ('green','yellow','red')),
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary_markdown text NOT NULL DEFAULT '',
  action_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_health_created ON daily_health_summaries(created_at DESC);
