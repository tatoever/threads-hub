-- Global buzz template library
-- 全アカウント共通のバズ構文テンプレを一元管理。各アカウントは buzz_templates を参照し、
-- キャラ口調は account_personas.tone_style から注入する。
-- requires_cta_type が set の場合、アカウントに該当 cta_type の有効 destination が無ければ候補外。

CREATE TABLE IF NOT EXISTS buzz_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 識別
  code TEXT UNIQUE NOT NULL,              -- "selective" / "prophecy" / "empathy" 等
  name TEXT NOT NULL,                     -- "選民フック" 等（人が見るラベル）
  description TEXT,                       -- 型の意図（2-3行）

  -- プロンプト本体（Opus に渡す差分指示）
  prompt_body TEXT NOT NULL,

  -- CTA ガード
  requires_cta_type TEXT,                 -- "note_url" 等。null=CTA不要
  cta_placement TEXT,                     -- "reply_tree_tail" / null

  -- 文字数・構造ヒント
  length_hint TEXT,                       -- "40-100" / "80-150" / "tree_200x3" 等

  -- 参考資料・メトリクス
  example_refs JSONB,                     -- [{"source":"threads","screenshot":"IMG_4003","note":"2347 likes"}, ...]
  avg_engagement JSONB,                   -- {"likes_min":500,"likes_max":9700,"comment_ratio":"high"}

  -- 運用
  is_active BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],    -- ["短文","ツリー必須","方言OK"] 等

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buzz_templates_active ON buzz_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_buzz_templates_cta ON buzz_templates(requires_cta_type) WHERE requires_cta_type IS NOT NULL;

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION trg_buzz_templates_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS buzz_templates_updated_at ON buzz_templates;
CREATE TRIGGER buzz_templates_updated_at
  BEFORE UPDATE ON buzz_templates
  FOR EACH ROW
  EXECUTE FUNCTION trg_buzz_templates_updated_at();
