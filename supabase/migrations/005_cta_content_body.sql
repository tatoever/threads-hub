-- 005_cta_content_body.sql
-- 誘導先ノート用に cta_destinations へ content_body カラムを追加
-- note のタイトル・URL・内容を1レコードで管理できるようにする
--
-- - name: タイトル（既存）
-- - url: note URL（既存）
-- - description: 概要（既存）
-- - content_body: 本文（貼り付けゾーン、新規）

ALTER TABLE cta_destinations
  ADD COLUMN IF NOT EXISTS content_body TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- content_body 全文検索用インデックス（将来のテンプレ誘導ツリー参照時）
CREATE INDEX IF NOT EXISTS idx_cta_destinations_type_active
  ON cta_destinations(account_id, cta_type, is_active);

COMMENT ON COLUMN cta_destinations.content_body IS 'noteなど誘導先の本文貼り付けゾーン。テンプレ誘導ツリー構築時に参照する素材';
COMMENT ON COLUMN cta_destinations.tags IS 'テンプレとのマッチング用タグ（例: ["スピリチュアル", "開運"]）';
