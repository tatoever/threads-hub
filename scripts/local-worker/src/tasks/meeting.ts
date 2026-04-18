/**
 * Phase 4: Meeting - 戦略立案（Opus）
 *
 * research + intelligence + community の結果を統合し、
 * 9本分のdaily_content_planを生成する。
 * CTA配置判断もここで行う。
 */

import { supabase } from "../utils/supabase";
import { callClaudeJson, type ModelType } from "../utils/claude-cli";
import type { TaskData } from "../task-executor";

export async function runMeeting(task: TaskData): Promise<Record<string, any>> {
  const { account_id, payload } = task;
  const date = payload.date || new Date().toISOString().split("T")[0];
  const model: ModelType = (task.model as ModelType) || "opus";

  // 1. Load all briefings from today's pipeline
  const { data: briefings } = await supabase
    .from("pipeline_runs")
    .select("phase, output_data")
    .eq("account_id", account_id)
    .eq("date", date)
    .in("phase", ["research", "intelligence", "community"])
    .eq("status", "completed");

  const briefMap: Record<string, any> = {};
  briefings?.forEach((b: any) => {
    briefMap[b.phase] = b.output_data;
  });

  // 2. Load persona
  const { data: persona } = await supabase
    .from("account_personas")
    .select("*")
    .eq("account_id", account_id)
    .single();

  // 3. Load account config
  const { data: account } = await supabase
    .from("accounts")
    .select("daily_post_target")
    .eq("id", account_id)
    .single();

  const postTarget = account?.daily_post_target || 9;

  // 4. Load CTA destinations
  const { data: ctaDestinations } = await supabase
    .from("cta_destinations")
    .select("*")
    .eq("account_id", account_id)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  // 4b. Load buzz templates (global library). Filter by CTA availability.
  const ctaTypesAvailable = new Set((ctaDestinations || []).map((d: any) => d.cta_type));
  const { data: allTemplates } = await supabase
    .from("buzz_templates")
    .select("code, name, description, length_hint, requires_cta_type, tags")
    .eq("is_active", true)
    .order("code");
  const buzzTemplates = (allTemplates || []).filter((t: any) =>
    !t.requires_cta_type || ctaTypesAvailable.has(t.requires_cta_type)
  );

  // 5. Load recent CTA placements (for rotation)
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: recentCtaPlacements } = await supabase
    .from("cta_placements")
    .select("destination_id, cta_text, placed_at")
    .eq("account_id", account_id)
    .gte("placed_at", threeDaysAgo.toISOString())
    .order("placed_at", { ascending: false });

  // 6. Load recent posts (for theme freshness)
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const { data: recentPosts } = await supabase
    .from("posts")
    .select("content, category, strategy_instructions, scheduled_at")
    .eq("account_id", account_id)
    .gte("scheduled_at", twoDaysAgo.toISOString())
    .order("scheduled_at", { ascending: false })
    .limit(20);

  // 7. Build meeting prompt
  const prompt = buildMeetingPrompt({
    persona,
    briefMap,
    postTarget,
    ctaDestinations: ctaDestinations || [],
    recentCtaPlacements: recentCtaPlacements || [],
    recentPosts: recentPosts || [],
    buzzTemplates,
    date,
  });

  // 8. Generate daily_content_plan (Opus)
  const { data: contentPlan } = await callClaudeJson(prompt, {
    model,
    systemPrompt: buildMeetingSystemPrompt(persona),
    timeoutMs: 180_000,
  });

  // 9. Save
  await supabase.from("pipeline_runs")
    .update({
      status: "completed",
      output_data: contentPlan,
      model_used: model,
      completed_at: new Date().toISOString(),
    })
    .eq("account_id", account_id)
    .eq("date", date)
    .eq("phase", "meeting");

  return { status: "completed", slots: contentPlan?.slots?.length || 0 };
}

function buildMeetingSystemPrompt(persona: any): string {
  return `あなたはSNSコンテンツ戦略ディレクターです。
データに基づいて今日の投稿戦略を立案し、${persona?.daily_post_target || 9}本分のスロット計画をJSON形式で出力してください。

重要ルール:
- 各スロットのテーマは互いに差別化すること（同じ話題の繰り返し禁止）
- 直近2日と同じテーマは最大1本まで
- CTA（誘導）は配置ルールに従い、自然な流れで挿入すること
- 誘導文は毎回違うバリエーションを使うこと`;
}

function buildMeetingPrompt(ctx: {
  persona: any;
  briefMap: Record<string, any>;
  postTarget: number;
  ctaDestinations: any[];
  recentCtaPlacements: any[];
  recentPosts: any[];
  buzzTemplates: any[];
  date: string;
}): string {
  const { persona, briefMap, postTarget, ctaDestinations, recentCtaPlacements, recentPosts, buzzTemplates, date } = ctx;

  return `# 本日のコンテンツ会議

## 日付
${date}

## アカウント情報
- ペルソナ: ${persona?.display_name || "未設定"}
- ジャンル: ${persona?.genre || "未設定"}
- ニッチ: ${persona?.niche || "未設定"}
- ターゲット: ${persona?.target_audience || "未設定"}
- 口調: ${persona?.tone_style || "未設定"}
- 本日の目標投稿数: ${postTarget}本

## リサーチ結果
${JSON.stringify(briefMap.research || {}, null, 2)}

## 実績分析（intelligence brief）
${JSON.stringify(briefMap.intelligence || {}, null, 2)}

${briefMap.intelligence?.tomorrow_recommendations && !briefMap.intelligence?.tomorrow_recommendations?.use_default_distribution ? `
### ⚠️ 明日への具体的推奨（最優先で反映）
- must_include: ${JSON.stringify(briefMap.intelligence.tomorrow_recommendations.must_include || [])}
- must_avoid: ${JSON.stringify(briefMap.intelligence.tomorrow_recommendations.must_avoid || [])}
- narrative_theme_hint: ${briefMap.intelligence.tomorrow_recommendations.narrative_theme_hint || "-"}
- slot_count_by_template: ${JSON.stringify(briefMap.intelligence.tomorrow_recommendations.slot_count_by_template || {})}

これらは前日までの実データ分析に基づく推奨。narrative_thread と slot 配分で必ず反映すること。
` : ""}

## コミュニティ分析
${JSON.stringify(briefMap.community || {}, null, 2)}

## 直近2日の投稿（テーマ重複回避用）
${recentPosts.map((p: any) => `- [${p.category}] ${p.content?.slice(0, 80)}...`).join("\n") || "なし"}

## CTA誘導先（配置可能）
${ctaDestinations.map((c: any) => `- ${c.name} (${c.cta_type}): ${c.url}\n  バリエーション: ${JSON.stringify(c.cta_templates)}\n  ルール: ${JSON.stringify(c.placement_rules)}`).join("\n") || "なし"}

## 直近3日のCTA配置履歴（ローテーション参考）
${recentCtaPlacements.map((p: any) => `- ${p.placed_at}: "${p.cta_text}"`).join("\n") || "なし"}

## バズ構文テンプレ（各スロットに1つ割り当てる）
${buzzTemplates.map((t: any) => `- code=${t.code} (${t.name}) / 長さ: ${t.length_hint || "-"} / tags: ${(t.tags || []).join(",")}\n  意図: ${t.description?.slice(0, 100) || ""}`).join("\n") || "（登録なし）"}

## 出力形式（JSON）
{
  "narrative_thread": "今日の投稿全体を貫くストーリーの軸",
  "slots": [
    {
      "slot_number": 1,
      "scheduled_time": "07:00",
      "category": "カテゴリ名",
      "theme": "テーマ",
      "hook_type": "フックの種類（共感/疑問/衝撃/数字等）",
      "buzz_template_code": "バズ構文テンプレのcode（9型から選ぶ。selective/prophecy/empathy_short/surreal_source/grandma_wisdom/confrontation/comment_hook/declaration/before_after_contrast）",
      "content_directive": "投稿内容の具体的な指示（50-100文字）",
      "emotional_target": { "entry": "読者の感情入口", "exit": "読者の感情出口" },
      "cta": null // or { "destination_name": "xxx", "method": "reply_tree", "cta_text": "使用する誘導文" }
    }
    // ... ${postTarget}スロット分
  ]
}

## buzz_template_code の割り当て指針
- 同じ code を連続配置しない（例: selective を1日3本以上は過剰）
- 9スロット中、最低6種類以上の code を使って多様性を確保
- comment_hook は個別返信運用が必要なので1日1本までに抑える
- requires_cta_type がある型は cta_destinations に該当 type がある時だけ割り当て可能
- 時間帯と型の相性を考える（朝=前向き予言/選民、夜=エモ諭し/告発 など）

## scheduled_time の自然な分散（重要）
- 時刻は 07:03, 08:47, 12:12, 14:38 等「キリの悪い分」を混ぜる
- 00 / 15 / 30 / 45 分 ばかりに偏らせない（5-8スロットは非キリのいい分に）
- システム側で ±10分 の微調整は入るので、Opus はあくまで大まかな意図時刻を設定
- スロット間は最低でも 45-60分 空ける（連投で相互干渉しないように）

## CTA配置の絶対ルール
- **slot.cta を設定していいのは buzz_template_code が 'cta_drive' のスロットだけ**
- それ以外の型（selective, prophecy, empathy_short 等）は slot.cta を必ず null にする
- 'cta_drive' 型は 1日最大2本まで（他7本以上は共感/教育型で構成）
- 'cta_drive' 型は夜帯（20:00以降）に配置するのが相性良い`;
}
