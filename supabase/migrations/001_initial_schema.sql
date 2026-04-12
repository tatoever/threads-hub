-- ============================================================
-- threads-hub: Multi-Account Threads Management Platform
-- Initial Schema - 16 Tables
-- ============================================================

-- 1. accounts（アカウントマスター）
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  threads_user_id TEXT,
  instagram_account_id TEXT,
  status TEXT DEFAULT 'setup' CHECK (status IN ('setup', 'testing', 'active', 'paused')),
  default_model TEXT DEFAULT 'opus' CHECK (default_model IN ('opus', 'sonnet')),
  schedule_offset_minutes INT DEFAULT 0,
  daily_post_target INT DEFAULT 9,
  pipeline_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. account_tokens（OAuth認証情報）
CREATE TABLE account_tokens (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  refresh_token TEXT,
  last_refreshed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked'))
);

-- 3. account_personas（ペルソナ設定）
CREATE TABLE account_personas (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  genre TEXT NOT NULL,
  niche TEXT,
  target_audience TEXT,
  value_proposition TEXT,
  tone_style TEXT NOT NULL,
  age_range TEXT,
  gender_feel TEXT,
  background TEXT,
  prohibited_words JSONB DEFAULT '[]',
  reply_rules JSONB DEFAULT '{}',
  prompt_files JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. account_prompts（アカウント別プロンプト）
CREATE TABLE account_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('research', 'intelligence', 'community', 'meeting', 'generate', 'reply')),
  prompt_name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model_preference TEXT DEFAULT 'opus' CHECK (model_preference IN ('opus', 'sonnet')),
  is_active BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. posts（投稿）
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'failed')),
  slot_number INT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  threads_post_id TEXT,
  metrics JSONB DEFAULT '{}',
  pipeline_run_id UUID,
  template_type TEXT,
  category TEXT,
  strategy_instructions JSONB DEFAULT '{}',
  reply_1 TEXT,
  reply_2 TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_posts_account_status ON posts(account_id, status);
CREATE INDEX idx_posts_account_scheduled ON posts(account_id, scheduled_at);

-- 6. pipeline_runs（パイプライン実行ログ）
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('research', 'intelligence', 'community', 'meeting', 'generate', 'publish')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  input_data JSONB,
  output_data JSONB,
  model_used TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(account_id, date, phase)
);

-- 7. task_queue（タスクキュー）
CREATE TABLE task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  priority INT DEFAULT 5,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payload JSONB NOT NULL,
  result JSONB,
  model TEXT DEFAULT 'opus' CHECK (model IN ('opus', 'sonnet')),
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  error_message TEXT
);

CREATE INDEX idx_task_queue_status_priority ON task_queue(status, priority, created_at);

-- 8. research_results（リサーチ結果）
CREATE TABLE research_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  research_type TEXT NOT NULL,
  raw_data JSONB,
  analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, date, research_type)
);

-- 9. research_sources（リサーチソース設定）
CREATE TABLE research_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('youtube', 'web_search', 'scrape_site')),
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. comments（コメント管理）
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  threads_comment_id TEXT UNIQUE,
  author_username TEXT,
  content TEXT,
  replied BOOLEAN DEFAULT false,
  reply_text TEXT,
  reply_status TEXT DEFAULT 'pending' CHECK (reply_status IN ('pending', 'approved', 'sent', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_account_status ON comments(account_id, reply_status);

-- 11. cta_destinations（誘導先コンテンツ管理）
CREATE TABLE cta_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cta_type TEXT NOT NULL CHECK (cta_type IN ('note_url', 'profile_link', 'affiliate', 'external')),
  url TEXT NOT NULL,
  description TEXT,
  cta_templates JSONB DEFAULT '[]',
  placement_rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 5,
  total_placements INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. cta_placements（誘導配置ログ）
CREATE TABLE cta_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES cta_destinations(id) ON DELETE CASCADE,
  placement_method TEXT NOT NULL CHECK (placement_method IN ('reply_tree', 'post_body', 'profile_mention')),
  cta_text TEXT NOT NULL,
  placed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cta_placements_account_date ON cta_placements(account_id, placed_at);

-- 13. post_analytics（投稿単位メトリクス）
CREATE TABLE post_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  replies INT DEFAULT 0,
  reposts INT DEFAULT 0,
  engagement_rate NUMERIC(5,4),
  fetched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_post_analytics_post ON post_analytics(post_id, fetched_at);

-- 14. account_daily_stats（アカウント日次集計）
CREATE TABLE account_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  posts_published INT DEFAULT 0,
  total_views INT DEFAULT 0,
  total_engagement INT DEFAULT 0,
  follower_count INT,
  follower_delta INT,
  cta_placements_count INT DEFAULT 0,
  pipeline_success BOOLEAN DEFAULT true,
  UNIQUE(account_id, date)
);

-- 15. system_alerts（異常検知）
CREATE TABLE system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_system_alerts_unresolved ON system_alerts(resolved, severity, created_at);

-- 16. rate_limit_log（レート制限追跡）
CREATE TABLE rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  limit_remaining INT,
  limit_total INT,
  reset_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS Policies (Phase 1: 単一管理者 = 全アクセス)
-- ============================================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cta_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cta_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Phase 1: service_role key で全アクセス（管理者のみ運用のため）
-- RLSポリシーはPhase 2以降でマルチユーザー対応時に追加
