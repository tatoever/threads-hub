/**
 * Phase 2: Intelligence - 自アカウントの実績分析
 *
 * 直近7日の投稿パフォーマンスを分析し、
 * 勝ち/負けパターン、カテゴリ別効果を抽出する。
 */

import { supabase } from "../utils/supabase";
import { callClaudeJson, type ModelType } from "../utils/claude-cli";
import type { TaskData } from "../task-executor";

export async function runIntelligence(task: TaskData): Promise<Record<string, any>> {
  const { account_id, payload } = task;
  const date = payload.date || new Date().toISOString().split("T")[0];

  // 1. Get last 7 days of published posts with analytics
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: recentPosts } = await supabase
    .from("posts")
    .select("*, post_analytics(*)")
    .eq("account_id", account_id)
    .eq("status", "published")
    .gte("published_at", weekAgo.toISOString())
    .order("published_at", { ascending: false });

  if (!recentPosts || recentPosts.length === 0) {
    // No data yet - skip
    await supabase.from("pipeline_runs").upsert({
      account_id, date, phase: "intelligence",
      status: "completed",
      output_data: { status: "no_data" },
      model_used: "sonnet",
      completed_at: new Date().toISOString(),
    });
    return { status: "skipped", reason: "no_recent_posts" };
  }

  // 2. Format data for analysis
  const postsForAnalysis = recentPosts.map((p: any) => {
    const analytics = Array.isArray(p.post_analytics) ? p.post_analytics[0] : p.post_analytics;
    return {
      content: p.content?.slice(0, 200),
      category: p.category,
      template_type: p.template_type,
      published_at: p.published_at,
      views: analytics?.views || 0,
      likes: analytics?.likes || 0,
      replies: analytics?.replies || 0,
      reposts: analytics?.reposts || 0,
      engagement_rate: analytics?.engagement_rate || 0,
    };
  });

  // 3. Load persona
  const { data: persona } = await supabase
    .from("account_personas")
    .select("genre, niche")
    .eq("account_id", account_id)
    .single();

  // 4. Analyze with Claude (Sonnet)
  const prompt = `# 投稿パフォーマンス分析

## アカウント
- ジャンル: ${persona?.genre || "未設定"}
- ニッチ: ${persona?.niche || "未設定"}

## 直近7日の投稿データ（${recentPosts.length}件）
${JSON.stringify(postsForAnalysis, null, 2)}

## 分析してJSON出力
{
  "win_patterns": ["高パフォーマンスの共通パターン 3-5個"],
  "lose_patterns": ["低パフォーマンスの共通パターン 2-3個"],
  "best_categories": ["効果が高いカテゴリ top3"],
  "optimal_times": ["エンゲージメントが高い時間帯"],
  "avg_views": "平均閲覧数",
  "avg_engagement_rate": "平均エンゲージメント率",
  "trend": "直近の傾向（上昇/下降/横ばい）",
  "recommendations": ["改善提案 2-3個"]
}`;

  const { data: analysis } = await callClaudeJson(prompt, {
    model: "sonnet" as ModelType,
    systemPrompt: "あなたはSNSアナリストです。投稿データを分析し、具体的で実用的なインサイトをJSON形式で出力してください。",
  });

  // 5. Save
  await supabase.from("pipeline_runs").upsert({
    account_id, date, phase: "intelligence",
    status: "completed",
    output_data: analysis,
    model_used: "sonnet",
    completed_at: new Date().toISOString(),
  });

  return { status: "completed", posts_analyzed: recentPosts.length };
}
