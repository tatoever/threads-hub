/**
 * Phase 2: Intelligence - 自アカウントの実績分析（本気化版）
 *
 * 直近14日の投稿パフォーマンスを buzz_template_code/時間帯/文字数 等の切り口で分析し、
 * 次回 meeting phase が直接食える形の推奨を出力する。
 */

import { supabase } from "../utils/supabase";
import { callClaudeJson, type ModelType } from "../utils/claude-cli";
import type { TaskData } from "../task-executor";

interface PostWithMetrics {
  id: string;
  content: string;
  published_at: string;
  scheduled_time?: string; // HH:MM (JST)
  buzz_template_code?: string;
  category?: string;
  hook_type?: string;
  has_tree: boolean;
  main_len: number;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  engagement_rate: number;
}

export async function runIntelligence(task: TaskData): Promise<Record<string, any>> {
  const { account_id, payload } = task;
  const date = payload.date || new Date().toISOString().split("T")[0];

  // 1. 直近14日の公開済投稿＋analytics を取得
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data: recentPosts } = await supabase
    .from("posts")
    .select("*, post_analytics(*)")
    .eq("account_id", account_id)
    .eq("status", "published")
    .gte("published_at", fourteenDaysAgo.toISOString())
    .order("published_at", { ascending: false });

  // Fallback: データ不足でも明日の meeting を壊さない
  if (!recentPosts || recentPosts.length < 3) {
    console.log(`[intelligence] Data insufficient (${recentPosts?.length || 0} posts). Returning default brief.`);
    const defaultBrief = {
      status: "insufficient_data",
      posts_analyzed: recentPosts?.length || 0,
      template_performance: [],
      time_x_template_matrix: [],
      length_analysis: { insufficient: true },
      week_over_week: { insufficient: true },
      tomorrow_recommendations: {
        use_default_distribution: true,
        note: "データ不足のためデフォルト配分。多様性優先で9スロット組む。",
      },
    };
    await persist(account_id, date, defaultBrief);
    return { status: "completed", posts_analyzed: recentPosts?.length || 0, reason: "insufficient_data" };
  }

  // 2. posts を分析用に正規化
  // buzz_template_code は strategy_instructions.buzz_template_code のみ参照。
  // template_type は古い「カテゴリ名」が混入してる可能性があるので fallback には使わない。
  const VALID_CODES = new Set([
    "selective", "prophecy", "empathy_short", "surreal_source", "grandma_wisdom",
    "confrontation", "comment_hook", "declaration", "before_after_contrast",
    "cta_drive", "story_real", "norm_breaker", "teaser_tree",
  ]);
  const normalized: PostWithMetrics[] = recentPosts.map((p: any) => {
    const analytics = Array.isArray(p.post_analytics) ? p.post_analytics[0] : p.post_analytics;
    const strategy = p.strategy_instructions || {};
    const rawCode = strategy.buzz_template_code;
    const cleanCode = rawCode && VALID_CODES.has(rawCode) ? rawCode : undefined;
    const publishedAt = new Date(p.published_at);
    const jstHour = (publishedAt.getUTCHours() + 9) % 24;
    const scheduled_time = `${String(jstHour).padStart(2, "0")}:${String(publishedAt.getUTCMinutes()).padStart(2, "0")}`;
    return {
      id: p.id,
      content: (p.content || "").slice(0, 200),
      published_at: p.published_at,
      scheduled_time,
      buzz_template_code: cleanCode,
      category: p.category,
      hook_type: strategy.hook_type,
      has_tree: !!(p.reply_1 || p.reply_2),
      main_len: (p.content || "").length,
      views: analytics?.views || 0,
      likes: analytics?.likes || 0,
      replies: analytics?.replies || 0,
      reposts: analytics?.reposts || 0,
      engagement_rate: analytics?.engagement_rate || 0,
    };
  });

  // 3. 前半/後半で比較データを作る (WoW相当)
  const mid = Math.floor(normalized.length / 2);
  const thisWeek = normalized.slice(0, mid); // 新しい方
  const lastWeek = normalized.slice(mid); // 古い方

  // 4. persona + buzz_templates マスタ取得
  const { data: persona } = await supabase
    .from("account_personas")
    .select("genre, niche, target_audience")
    .eq("account_id", account_id)
    .single();

  const { data: templates } = await supabase
    .from("buzz_templates")
    .select("code, name, tags")
    .eq("is_active", true);

  // 5. Opus にリッチ分析依頼
  const prompt = `# 投稿パフォーマンス分析（14日分・本気化版）

## アカウント
- ジャンル: ${persona?.genre || "未設定"}
- ニッチ: ${persona?.niche || "未設定"}
- ターゲット: ${persona?.target_audience || "未設定"}

## 使用中のバズ構文テンプレ（buzz_templates）
${(templates || []).map((t: any) => `- ${t.code} (${t.name}) [${(t.tags || []).join(",")}]`).join("\n")}

## 今週（最新 ${thisWeek.length}件）
${JSON.stringify(thisWeek, null, 2)}

## 先週（古い ${lastWeek.length}件）
${JSON.stringify(lastWeek, null, 2)}

## 分析してJSON出力（以下スキーマ厳守）

{
  "status": "ok",
  "posts_analyzed": ${normalized.length},
  "template_performance": [
    {
      "code": "テンプレコード",
      "posts_count": 数,
      "avg_likes": 平均いいね,
      "avg_engagement_rate": 平均エンゲージ率,
      "best_time": "HH:MM その型が最も強かった時間帯",
      "verdict": "hot / solid / weak"
    }
  ],
  "time_x_template_matrix": [
    { "time_band": "morning/noon/evening/night", "top_template": "code", "avg_engagement": 数値, "note": "一言所感" }
  ],
  "length_analysis": {
    "sweet_spot_main_len": "80-120 等のレンジ",
    "over_200_penalty": "200字超の投稿はエンゲージ率がXX%低い 等",
    "tree_vs_single": "ツリーの方が平均XX%高い 等"
  },
  "week_over_week": {
    "engagement_delta": "+XX% or -XX% or 横ばい",
    "rising_template": "伸びてる型 code",
    "declining_template": "落ちてる型 code"
  },
  "tomorrow_recommendations": {
    "must_include": [
      { "template_code": "code", "time": "HH:MM", "reason": "理由" }
    ],
    "must_avoid": ["避けるべきパターン 具体的に"],
    "narrative_theme_hint": "narrative_thread を決める際のヒント（一言）",
    "slot_count_by_template": { "selective": 2, "empathy_short": 1 }
  },
  "key_insights": [
    "データから見える重要な学び 3-5個"
  ]
}

重要:
- template_performance は posts_count が1件以上あるcodeのみ列挙
- データ希薄な項目は "insufficient" と書いてもOK
- tomorrow_recommendations は翌日の meeting phase が直接食える具体性で出す`;

  const { data: analysis } = await callClaudeJson(prompt, {
    model: "sonnet" as ModelType,
    systemPrompt: "あなたはSNSアナリストです。投稿データを分析し、次のコンテンツ戦略に直接活かせるインサイトをJSON形式で出力してください。",
    timeoutMs: 180_000,
  });

  await persist(account_id, date, analysis);

  return { status: "completed", posts_analyzed: normalized.length };
}

async function persist(account_id: string, date: string, output: any) {
  const { error } = await supabase
    .from("pipeline_runs")
    .update({
      status: "completed",
      output_data: output,
      model_used: "sonnet",
      completed_at: new Date().toISOString(),
    })
    .eq("account_id", account_id)
    .eq("date", date)
    .eq("phase", "intelligence");
  if (error) console.error("[intelligence] persist failed:", error.message);
}
