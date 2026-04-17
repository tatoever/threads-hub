-- Migration 003: Character knowledge layers (3 JSONB columns)
-- Adds per-character knowledge storage for 3 frameworks:
--   1. growth_principles_adapted  (7垢万垢式 Threads攻略6原則のキャラ別適応)
--   2. fan_marketing_stance       (おきるママ式 共感マーケ・ファン化原則のキャラ別定義)
--   3. post_type_materials        (モブえもん式 投稿6つの型のキャラ別素材)
--
-- See: _AIエージェント/multi-account-threads-platform_要件定義.md
--   §3.7.2.6, §3.7.3.2, §3.7.5.2

-- === account_personas に3JSONB追加 ===
ALTER TABLE account_personas
  ADD COLUMN IF NOT EXISTS growth_principles_adapted JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fan_marketing_stance     JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS post_type_materials      JSONB DEFAULT '{}'::jsonb;

-- === accounts に profile_tagline + warmup_* 追加 ===
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS profile_tagline      JSONB,
  ADD COLUMN IF NOT EXISTS warmup_started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warmup_days_elapsed  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warmup_daily_target  INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS warmup_time_slots    TEXT[] DEFAULT ARRAY['朝','昼','夜'],
  ADD COLUMN IF NOT EXISTS warmup_skip_day_count INT DEFAULT 0;

-- === accounts に concept_* 追加（Concept Designer サブシステム用） ===
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS concept_status     TEXT DEFAULT 'pending_research',
  ADD COLUMN IF NOT EXISTS concept_definition JSONB;

-- === account_settings (reply用) 追加 ===
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS reply_model            TEXT DEFAULT 'opus',
  ADD COLUMN IF NOT EXISTS reply_skip_rate        INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS reply_max_per_user_daily INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS reply_max_per_post     INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS reply_max_daily        INT DEFAULT 200,
  ADD COLUMN IF NOT EXISTS reply_quiet_hours      TEXT DEFAULT '02:30-07:00',
  ADD COLUMN IF NOT EXISTS reply_delay_min_sec    INT DEFAULT 25,
  ADD COLUMN IF NOT EXISTS reply_delay_max_sec    INT DEFAULT 45,
  ADD COLUMN IF NOT EXISTS reply_auto_enabled     BOOLEAN DEFAULT true;

-- === Concept Designer 用テーブル ===
CREATE TABLE IF NOT EXISTS concept_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_concept_research_account ON concept_research(account_id);

CREATE TABLE IF NOT EXISTS concept_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  common_means TEXT[],
  common_positions TEXT[],
  hot_reactions JSONB,
  reverse_opportunities JSONB,
  import_candidates JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_concept_analysis_account ON concept_analysis(account_id);

CREATE TABLE IF NOT EXISTS concept_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  proposal_rank INT NOT NULL,
  concept_name TEXT NOT NULL,
  means_shift TEXT NOT NULL,
  position_shift TEXT NOT NULL,
  establishment_reason TEXT,
  weirdness_score INT,
  target_reaction_prediction JSONB,
  status TEXT DEFAULT 'pending',
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_concept_proposals_account ON concept_proposals(account_id);

COMMENT ON COLUMN account_personas.growth_principles_adapted IS '7垢万垢式 Threads攻略6原則のキャラ別適応';
COMMENT ON COLUMN account_personas.fan_marketing_stance IS 'おきるママ式 共感マーケ・ファン化原則のキャラ別定義（A1-A6, A8）';
COMMENT ON COLUMN account_personas.post_type_materials IS 'モブえもん式 投稿6つの型のキャラ別素材（C1-C6）';
COMMENT ON COLUMN accounts.concept_status IS 'Concept Designer 進行状態: pending_research/researching/ready_for_review/approved/locked';
COMMENT ON COLUMN accounts.concept_definition IS '承認済みコンセプト定義（手段×立場）';
