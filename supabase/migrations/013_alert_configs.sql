-- アラート種別ごとの設定（ON/OFF + 説明 + 推奨アクション）
-- 発火箇所は insertAlert ヘルパー経由で enabled を参照し、OFFなら insert をスキップする
CREATE TABLE IF NOT EXISTS alert_configs (
  alert_type text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  default_severity text NOT NULL DEFAULT 'warning' CHECK (default_severity IN ('critical', 'warning', 'info')),
  display_label text NOT NULL,
  description text NOT NULL,
  when_it_fires text NOT NULL,
  why_it_matters text NOT NULL,
  recommended_action text NOT NULL,
  implementation_status text NOT NULL DEFAULT 'active' CHECK (implementation_status IN ('active', 'planned')),
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_configs_enabled ON alert_configs(enabled);
