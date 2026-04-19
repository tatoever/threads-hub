-- ============================================================
-- 007: articles CMS 機能
-- threads-hub 内製 note-like 記事公開基盤
-- ============================================================

-- 1. articles（記事本体）
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  body_html TEXT,                             -- レンダリング済キャッシュ（任意、ISR時に無くてOK）
  cover_image_url TEXT,                        -- 記事ヘッダー画像
  og_image_url TEXT,                           -- OGP画像（cover と別にカスタム可）
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,                    -- 将来公開予約
  word_count INT,
  reading_time_sec INT,                        -- フロント用の「◯分で読めます」
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,      -- {description, keywords, canonical_url}
  affiliate_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{pos_in_md, type, url, label}]
  metrics_cache JSONB NOT NULL DEFAULT '{}'::jsonb,     -- 日次集計のキャッシュ
  pipeline_run_id UUID,                        -- intelligence フィードバック軸（nullable）
  created_by TEXT,                             -- 作成者識別（Claude / admin）
  review_notes TEXT,                           -- レビュー時の差し戻しコメント
  version INT NOT NULL DEFAULT 1,              -- 編集履歴管理用
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, slug)
);

-- インデックス
CREATE INDEX idx_articles_account_status ON articles(account_id, status, published_at DESC NULLS LAST);
CREATE INDEX idx_articles_status_scheduled ON articles(status, scheduled_at) WHERE status = 'pending_review' OR scheduled_at IS NOT NULL;
CREATE INDEX idx_articles_published ON articles(published_at DESC) WHERE status = 'published';

-- 2. article_revisions（編集履歴）
CREATE TABLE article_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  version INT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  saved_by TEXT,                               -- 'claude' | 'admin' | user email
  diff_summary TEXT,                           -- 任意のメモ
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_article_revisions_article ON article_revisions(article_id, version DESC);

-- 3. article_images（アップロードされた画像）
CREATE TABLE article_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,  -- 下書き段階でnullも許可（下書き中のアップ）
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  original_path TEXT NOT NULL,                 -- Supabase Storage path
  webp_original_path TEXT,
  webp_1200_path TEXT,
  webp_800_path TEXT,
  alt_text TEXT,
  original_size_bytes INT,
  compressed_size_bytes INT,
  width INT,
  height INT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_article_images_article ON article_images(article_id);
CREATE INDEX idx_article_images_account ON article_images(account_id);

-- 4. article_events（アクセス・クリック・スクロール等の生イベント）
CREATE TABLE article_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('view', 'scroll', 'dwell', 'cta_click', 'image_click', 'exit')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {scroll_pct, dwell_ms, cta_id, x, y, referrer, device}
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- BRIN index on time column is efficient for append-only events tables
CREATE INDEX idx_article_events_time ON article_events USING BRIN (occurred_at);
CREATE INDEX idx_article_events_article_time ON article_events(article_id, occurred_at DESC);

-- 5. article_sessions（セッション単位の集約）
CREATE TABLE article_sessions (
  session_id TEXT NOT NULL,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entry_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_ts TIMESTAMPTZ,
  max_scroll_pct INT,                          -- 0-100
  duration_ms INT,                             -- visibilityState=visible の累積
  referrer TEXT,
  utm JSONB DEFAULT '{}'::jsonb,               -- {source, medium, campaign}
  device TEXT,                                 -- 'mobile' | 'desktop' | 'tablet'
  PRIMARY KEY (session_id, article_id)
);
CREATE INDEX idx_article_sessions_article ON article_sessions(article_id, entry_ts DESC);

-- 6. article_daily_stats（日次集計、ダッシュボード高速表示用）
CREATE TABLE article_daily_stats (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  pv INT NOT NULL DEFAULT 0,
  uv INT NOT NULL DEFAULT 0,
  avg_duration_sec INT,
  scroll_p25 NUMERIC(5,2),                     -- 25%到達率
  scroll_p50 NUMERIC(5,2),
  scroll_p75 NUMERIC(5,2),
  scroll_p100 NUMERIC(5,2),
  cta_click_count INT NOT NULL DEFAULT 0,
  cta_click_ctr NUMERIC(5,2),                  -- CTR %
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, stat_date)
);
CREATE INDEX idx_article_daily_stats_account_date ON article_daily_stats(account_id, stat_date DESC);

-- 7. updated_at トリガー
CREATE OR REPLACE FUNCTION update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_articles_updated_at();

-- 8. RLS（Row Level Security）- 公開記事のみ anon 読取許可
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published articles are readable by anyone"
  ON articles FOR SELECT
  TO anon
  USING (status = 'published');

CREATE POLICY "Service role has full access"
  ON articles FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- article_events の anon INSERT 許可（公開ページからのイベント収集）
ALTER TABLE article_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert events"
  ON article_events FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service role has full access to events"
  ON article_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- images, sessions, stats は service_role のみアクセス（公開ページは集計済みを直接読まない）
ALTER TABLE article_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role access" ON article_images FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role access" ON article_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role access" ON article_daily_stats FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role access" ON article_revisions FOR ALL TO service_role USING (true) WITH CHECK (true);
