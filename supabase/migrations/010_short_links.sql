-- ============================================================
-- 010: short_links — A8 等のアフィリURLを自前ドメインでラップ
-- note-sub.top/go/{slug} → 302 redirect + click 計測
-- ============================================================

CREATE TABLE short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,               -- /go/{slug}（5文字のランダム英数字）
  target_url TEXT NOT NULL,                -- 実際のアフィリURL（A8等）
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  label TEXT,                              -- 人間可読ラベル（例: "kokonara-a8"）
  click_count INT NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_short_links_article ON short_links(article_id) WHERE article_id IS NOT NULL;
CREATE INDEX idx_short_links_account ON short_links(account_id) WHERE account_id IS NOT NULL;

-- anon が SELECT できないよう RLS
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access" ON short_links FOR ALL TO service_role USING (true) WITH CHECK (true);
