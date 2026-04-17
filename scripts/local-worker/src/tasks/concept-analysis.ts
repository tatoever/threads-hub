/**
 * Task handler: concept_analysis
 *
 * Phase B of Concept Designer subsystem.
 * Analyzes market data from Phase A and applies reverse axis matrix + cross-SNS import analysis.
 *
 * See: _AIエージェント/concept-designer-spec.md §3.2
 */

import { supabase } from "../utils/supabase";
import { callClaudeJson } from "../utils/claude-cli";

const SYSTEM_PROMPT = `あなたはコンセプト設計の分析家です。収集された市場データから「当たり前」を洗い出し、逆張りマトリクスを適用して、別SNSから輸入できるコンセプト候補を提示してください。

## 分析観点
1. 当たり前の構造化: 手段と立場を分けて、各カテゴリの頻度順にリスト化
2. 逆張りマトリクス: 以下の8軸それぞれで、このジャンルでどうズラせるか分析
   - 努力正義 ↔ 楽して勝つ
   - 継続全て ↔ 続かない人前提
   - 行動量勝負 ↔ 設計勝負
   - 意識高い系 ↔ 怠惰系
   - 上品 ↔ 生々しい
   - 追わせる ↔ 自分から行く
   - 清楚風 ↔ 本音むき出し
   - 丁寧 ↔ 雑でもOK
3. 別SNS輸入候補: YouTube/IG の成功フォーマットを Threads に持ち込む場合の候補
4. 失敗パターン回避チェック: 奇抜すぎ・自分起点・肩書き変更だけに陥っていないか

## 出力形式（JSON）
{
  "common_means_ranked": [{ "means": "...", "frequency": "高/中/低" }],
  "common_positions_ranked": [{ "position": "...", "frequency": "高/中/低" }],
  "reverse_axis_opportunities": [
    {
      "axis": "...",
      "market_side": "...",
      "reverse_opportunity": "...",
      "risk": "..."
    }
  ],
  "cross_sns_import_candidates": [
    {
      "source_platform": "...",
      "source_format": "...",
      "adapted_to_threads": "...",
      "viability": "high/medium/low"
    }
  ],
  "failure_pattern_warnings": []
}`;

export async function runConceptAnalysis(task: any) {
  const accountId = task.account_id;

  // Check upstream: concept_research must have data
  const { data: research } = await supabase
    .from("concept_research")
    .select("data")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!research) {
    throw new Error("concept_research not found; upstream phase not completed");
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("name")
    .eq("id", accountId)
    .single();

  const userPrompt = `## ターゲットキャラクター
${account?.name || "unknown"}

## Phase A の市場リサーチ結果
${JSON.stringify(research.data, null, 2)}

このデータをもとに、指定スキーマで分析結果を出力せよ。`;

  const { data } = await callClaudeJson<any>(userPrompt, {
    model: (task.model || "opus") as "opus" | "sonnet",
    systemPrompt: SYSTEM_PROMPT,
    timeoutMs: 180_000,
  });

  await supabase.from("concept_analysis").insert({
    account_id: accountId,
    common_means: (data.common_means_ranked || []).map((x: any) => x.means || x),
    common_positions: (data.common_positions_ranked || []).map((x: any) => x.position || x),
    hot_reactions: research.data.hot_reaction_patterns || [],
    reverse_opportunities: data.reverse_axis_opportunities || [],
    import_candidates: data.cross_sns_import_candidates || [],
  });

  return { status: "completed", warnings: data.failure_pattern_warnings || [] };
}
