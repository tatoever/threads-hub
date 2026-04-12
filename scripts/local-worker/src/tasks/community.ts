/**
 * Phase 3: Community - 自アカウントのコメント分析
 */

import { supabase } from "../utils/supabase";
import { callClaudeJson, type ModelType } from "../utils/claude-cli";
import type { TaskData } from "../task-executor";

export async function runCommunity(task: TaskData): Promise<Record<string, any>> {
  const { account_id, payload } = task;
  const date = payload.date || new Date().toISOString().split("T")[0];

  // 1. Get recent comments (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: comments } = await supabase
    .from("comments")
    .select("content, author_username, created_at")
    .eq("account_id", account_id)
    .gte("created_at", weekAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(100);

  if (!comments || comments.length === 0) {
    await supabase.from("pipeline_runs").upsert({
      account_id, date, phase: "community",
      status: "completed",
      output_data: { status: "no_comments" },
      model_used: "sonnet",
      completed_at: new Date().toISOString(),
    });
    return { status: "skipped", reason: "no_recent_comments" };
  }

  // 2. Analyze with Sonnet
  const prompt = `# コミュニティコメント分析

## 直近7日のコメント（${comments.length}件）
${comments.map((c: any) => `- @${c.author_username}: ${c.content}`).join("\n")}

## JSON出力
{
  "trending_topics": ["コメントで多い話題 3-5個"],
  "content_worthy_comments": ["投稿ネタに使えそうなコメント・質問 3-5個"],
  "sentiment": "全体的な感情傾向（ポジティブ/ネガティブ/混在）",
  "audience_needs": ["フォロワーが求めていること 2-3個"],
  "engagement_triggers": ["反応が多かったトピック 2-3個"]
}`;

  const { data: analysis } = await callClaudeJson(prompt, {
    model: "sonnet" as ModelType,
    systemPrompt: "SNSコミュニティアナリストとして、コメントを分析し実用的なインサイトをJSON出力してください。",
  });

  await supabase.from("pipeline_runs").upsert({
    account_id, date, phase: "community",
    status: "completed",
    output_data: analysis,
    model_used: "sonnet",
    completed_at: new Date().toISOString(),
  });

  return { status: "completed", comments_analyzed: comments.length };
}
