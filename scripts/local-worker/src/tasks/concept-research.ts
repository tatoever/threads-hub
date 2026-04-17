/**
 * Task handler: concept_research
 *
 * Phase A of Concept Designer subsystem.
 * Collects market data (Threads/YouTube/Instagram) for the target character
 * and extracts common patterns (手段 / 立場 / 熱量リプ / ニッチの空白).
 *
 * See: _AIエージェント/concept-designer-spec.md §3.1
 */

import { supabase } from "../utils/supabase";
import { callClaudeJson } from "../utils/claude-cli";

const SYSTEM_PROMPT = `あなたはThreads市場リサーチャーです。指定されたターゲット層・ジャンルに対して、以下を網羅的に収集・整理してください。

## 収集対象
1. Threads 上位アカウント分析: 検索ワードで上位30投稿を仮想収集 → どんな「手段」で、どんな「立場」で発信している人が伸びているか
2. YouTube 人気チャンネル分析: 同ジャンルで登録者数が多いチャンネル10個程度 → 使われている切り口・フォーマット
3. Instagram 人気アカウント分析: 同じジャンルで人気のアカウント10個程度 → ポジショニングの傾向
4. 熱量の高いリアクション抽出: 各投稿のコメント・リプで「共感しました」「まさに今の自分」系の熱量リプがあったか

## 出力形式（JSON）
以下のスキーマで出力せよ。追加説明は一切不要。

{
  "queries_used": ["実際に検索したワード"],
  "common_means": ["市場で使われている『手段』のリスト"],
  "common_positions": ["市場で見られる『立場』のリスト"],
  "hot_reaction_patterns": ["熱量の高いリプのパターン"],
  "niche_blindspots": ["この市場で埋まっていない切り口（仮説）"],
  "cross_sns_successful_formats": [
    { "platform": "youtube", "format": "例: 30分検証企画", "why_it_works": "理由" }
  ]
}`;

export async function runConceptResearch(task: any) {
  const accountId = task.account_id;

  // Load account + persona
  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, slug")
    .eq("id", accountId)
    .single();

  const { data: persona } = await supabase
    .from("account_personas")
    .select("niche, target_audience, value_proposition, genre, background")
    .eq("account_id", accountId)
    .single();

  if (!account || !persona) {
    throw new Error(`account or persona not found for ${accountId}`);
  }

  const userPrompt = `## ターゲットキャラクター
- name: ${account.name}
- genre: ${persona.genre}
- niche: ${persona.niche}
- target_audience: ${persona.target_audience}
- value_proposition: ${persona.value_proposition}
- background: ${persona.background}

このキャラが参入する市場（Threads / YouTube / Instagram）を網羅的にリサーチし、指定されたJSONスキーマで出力せよ。`;

  const { data } = await callClaudeJson<any>(userPrompt, {
    model: (task.model || "opus") as "opus" | "sonnet",
    systemPrompt: SYSTEM_PROMPT,
    timeoutMs: 180_000,
  });

  // Save to concept_research (one row per source, or one aggregated row)
  await supabase.from("concept_research").insert({
    account_id: accountId,
    source: "aggregated",
    data,
  });

  return { status: "completed", research_keys: Object.keys(data).join(",") };
}
