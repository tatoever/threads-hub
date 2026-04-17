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
  date: string;
}): string {
  const { persona, briefMap, postTarget, ctaDestinations, recentCtaPlacements, recentPosts, date } = ctx;

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

## 実績分析
${JSON.stringify(briefMap.intelligence || {}, null, 2)}

## コミュニティ分析
${JSON.stringify(briefMap.community || {}, null, 2)}

## 直近2日の投稿（テーマ重複回避用）
${recentPosts.map((p: any) => `- [${p.category}] ${p.content?.slice(0, 80)}...`).join("\n") || "なし"}

## CTA誘導先（配置可能）
${ctaDestinations.map((c: any) => `- ${c.name} (${c.cta_type}): ${c.url}\n  バリエーション: ${JSON.stringify(c.cta_templates)}\n  ルール: ${JSON.stringify(c.placement_rules)}`).join("\n") || "なし"}

## 直近3日のCTA配置履歴（ローテーション参考）
${recentCtaPlacements.map((p: any) => `- ${p.placed_at}: "${p.cta_text}"`).join("\n") || "なし"}

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
      "content_directive": "投稿内容の具体的な指示（50-100文字）",
      "emotional_target": { "entry": "読者の感情入口", "exit": "読者の感情出口" },
      "cta": null // or { "destination_name": "xxx", "method": "reply_tree", "cta_text": "使用する誘導文" }
    }
    // ... ${postTarget}スロット分
  ]
}`;
}
