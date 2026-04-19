-- ============================================================
-- 008: cta_destinations への article_id FK 追加
-- 内部記事を CTA 誘導先として使える設計に拡張
-- ============================================================

-- cta_type の拡張: 'internal_article' を追加可能にするため、既存 CHECK 制約を削除して再作成
ALTER TABLE cta_destinations DROP CONSTRAINT IF EXISTS cta_destinations_cta_type_check;

ALTER TABLE cta_destinations
  ADD CONSTRAINT cta_destinations_cta_type_check
  CHECK (cta_type IN ('note_url', 'profile_link', 'affiliate', 'external', 'internal_article'));

-- article_id FK を追加（nullable; 外部URLと内部記事の両対応）
ALTER TABLE cta_destinations
  ADD COLUMN IF NOT EXISTS article_id UUID REFERENCES articles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cta_destinations_article ON cta_destinations(article_id) WHERE article_id IS NOT NULL;

-- 整合性チェック: cta_type='internal_article' の場合は article_id 必須
-- （DBレベルではなくアプリ層でチェック。将来必要なら CHECK 制約追加）
