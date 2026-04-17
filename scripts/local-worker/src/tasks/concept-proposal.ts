/**
 * Task handler: concept_proposal
 *
 * Phase C of Concept Designer subsystem.
 * Generates 3 concept proposals (手段 × 立場 の組み替え) based on analysis.
 *
 * See: _AIエージェント/concept-designer-spec.md §3.3
 */

import { supabase } from "../utils/supabase";
import { callClaudeJson } from "../utils/claude-cli";
import { notifyDiscord } from "../utils/notify";

const SYSTEM_PROMPT = `あなたはコンセプト設計の最終決断者です。市場リサーチと分析データをもとに、このキャラ用の「手段×立場」のコンセプト案を3つ提示してください。

## 設計原則
- 後出しじゃんけん: 市場から逆算する。自分起点はNG
- ズラし≠奇抜: 「理解できる違い」に留める
- 成立理由をズラす: 肩書き変更だけの表面変更はNG

## 3案の構成
- 案1（推奨）: 最もバランスの取れた案
- 案2（攻め）: 奇抜度やや高めだが差別化強い案
- 案3（安全）: 既存成功例に寄せた再現性重視案

## 奇抜度スコア
- 0-2: 市場で既に受け入れられている範囲
- 3-4: 新鮮だが理解しやすい（推奨ゾーン）
- 5-7: 独自性高いが説明が必要
- 8-10: 奇抜すぎて受け入れられないリスク（却下）

## 出力形式（JSON）
{
  "proposals": [
    {
      "rank": 1,
      "concept_name": "...",
      "means_shift": "...",
      "position_shift": "...",
      "establishment_reason": "...",
      "weirdness_score": 3,
      "target_reaction_prediction": {
        "positive": ["..."],
        "negative": ["..."]
      }
    },
    { "rank": 2, ... },
    { "rank": 3, ... }
  ]
}

重要: weirdness_score が 5 以上の案は rank 1 に出すな。`;

export async function runConceptProposal(task: any) {
  const accountId = task.account_id;

  // Load upstream data
  const [account, persona, research, analysis] = await Promise.all([
    supabase.from("accounts").select("id, name, slug").eq("id", accountId).single(),
    supabase.from("account_personas").select("*").eq("account_id", accountId).single(),
    supabase.from("concept_research").select("data").eq("account_id", accountId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("concept_analysis").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!research.data || !analysis.data) {
    throw new Error("upstream research or analysis missing");
  }

  // Include feedback if present (from rejected round)
  const feedback = task.payload?.feedback;

  const userPrompt = `## ターゲットキャラクター
- name: ${account.data?.name}
- niche: ${persona.data?.niche}
- target_audience: ${persona.data?.target_audience}
- value_proposition: ${persona.data?.value_proposition}
- background: ${persona.data?.background}

## Phase A 市場リサーチ結果
${JSON.stringify(research.data.data, null, 2)}

## Phase B 分析結果
${JSON.stringify(
  {
    common_means: analysis.data.common_means,
    common_positions: analysis.data.common_positions,
    reverse_opportunities: analysis.data.reverse_opportunities,
    import_candidates: analysis.data.import_candidates,
  },
  null,
  2
)}

${feedback ? `## ⚠️ 前回の提案への差し戻しフィードバック\n${feedback}\n\nこのフィードバックを踏まえて別方向の3案を出せ。` : ""}

指定スキーマで3案を出力せよ。`;

  const { data } = await callClaudeJson<any>(userPrompt, {
    model: (task.model || "opus") as "opus" | "sonnet",
    systemPrompt: SYSTEM_PROMPT,
    timeoutMs: 180_000,
  });

  const proposals = data.proposals || [];
  if (proposals.length === 0) {
    throw new Error("Claude returned no proposals");
  }

  // Validate: rank 1 must have weirdness_score < 5
  const rank1 = proposals.find((p: any) => p.rank === 1);
  if (rank1 && rank1.weirdness_score >= 5) {
    throw new Error(`rank 1 weirdness_score too high: ${rank1.weirdness_score}`);
  }

  // Insert all proposals
  const rows = proposals.map((p: any) => ({
    account_id: accountId,
    proposal_rank: p.rank,
    concept_name: p.concept_name,
    means_shift: p.means_shift,
    position_shift: p.position_shift,
    establishment_reason: p.establishment_reason,
    weirdness_score: p.weirdness_score,
    target_reaction_prediction: p.target_reaction_prediction,
    status: "pending",
  }));

  await supabase.from("concept_proposals").insert(rows);

  // Update account status
  await supabase.from("accounts").update({ concept_status: "ready_for_review" }).eq("id", accountId);

  // Notify via Discord
  await notifyDiscord(
    `🎨 ${account.data?.name} コンセプト案3件生成完了\n推奨案: 「${rank1?.concept_name}」（奇抜度: ${rank1?.weirdness_score}）\n管理画面で承認してください。`,
    "info"
  ).catch(() => {});

  return { status: "completed", proposals_count: proposals.length, recommended: rank1?.concept_name };
}
