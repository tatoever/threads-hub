/**
 * Phase 5: Generate - 投稿生成（投稿時刻の30-60分前に1本ずつ）
 *
 * meetingのdaily_content_planから該当スロットを取得し、
 * ペルソナに基づいてCoT生成→品質チェック→保存。
 */

import { supabase } from "../utils/supabase";
import { callClaude, callClaudeJson, type ModelType } from "../utils/claude-cli";
import type { TaskData } from "../task-executor";

export async function runGenerate(task: TaskData): Promise<Record<string, any>> {
  const { account_id, payload } = task;
  const date = payload.date || new Date().toISOString().split("T")[0];
  const slotNumber = payload.slot_number;
  const model: ModelType = (task.model as ModelType) || "opus";

  // 1. Load meeting plan
  const { data: meetingRun } = await supabase
    .from("pipeline_runs")
    .select("output_data")
    .eq("account_id", account_id)
    .eq("date", date)
    .eq("phase", "meeting")
    .eq("status", "completed")
    .single();

  if (!meetingRun?.output_data) {
    throw new Error("Meeting plan not found. Run meeting phase first.");
  }

  const contentPlan = meetingRun.output_data as any;
  const slot = contentPlan.slots?.find((s: any) => s.slot_number === slotNumber);

  if (!slot) {
    throw new Error(`Slot ${slotNumber} not found in content plan`);
  }

  // 2. Load persona + prompts
  const { data: persona } = await supabase
    .from("account_personas")
    .select("*")
    .eq("account_id", account_id)
    .single();

  const { data: genPrompt } = await supabase
    .from("account_prompts")
    .select("system_prompt")
    .eq("account_id", account_id)
    .eq("phase", "generate")
    .eq("is_active", true)
    .single();

  // 3. Generate post content
  const systemPrompt = genPrompt?.system_prompt || buildDefaultSystemPrompt(persona);
  const userPrompt = buildGeneratePrompt(slot, contentPlan.narrative_thread, persona);

  const result = await callClaude(userPrompt, {
    model,
    systemPrompt,
    timeoutMs: 120_000,
  });

  // 4. Extract content (strip any markdown/thinking)
  let postContent = extractPostContent(result.text);

  // 5. Quality check
  const qualityResult = await runQualityCheck(postContent, persona);

  if (!qualityResult.passed) {
    // Auto-fix attempt
    const fixPrompt = `以下の投稿を修正してください。問題点: ${qualityResult.issues.join(", ")}

元の投稿:
${postContent}

修正後の投稿のみを出力してください（500文字以内）。`;

    const fixResult = await callClaude(fixPrompt, { model, systemPrompt });
    postContent = extractPostContent(fixResult.text);
  }

  // 6. Build reply texts (including CTA if assigned)
  let reply1: string | null = null;
  let reply2: string | null = null;

  if (slot.cta) {
    // CTA is placed in a reply
    if (slot.cta.method === "reply_tree") {
      reply1 = slot.cta.cta_text;
    }
  }

  // 7. Calculate scheduled_at
  const scheduledAt = `${date}T${slot.scheduled_time}:00+09:00`; // JST

  // 8. Save post
  const { data: savedPost, error: saveError } = await supabase
    .from("posts")
    .insert({
      account_id,
      content: postContent,
      status: "approved",
      slot_number: slotNumber,
      scheduled_at: scheduledAt,
      template_type: slot.category,
      category: slot.category,
      strategy_instructions: slot,
      reply_1: reply1,
      reply_2: reply2,
    })
    .select()
    .single();

  if (saveError) {
    throw new Error(`Failed to save post: ${saveError.message}`);
  }

  // 9. Save CTA placement if applicable
  if (slot.cta && savedPost) {
    const { data: ctaDest } = await supabase
      .from("cta_destinations")
      .select("id")
      .eq("account_id", account_id)
      .eq("name", slot.cta.destination_name)
      .single();

    if (ctaDest) {
      await supabase.from("cta_placements").insert({
        account_id,
        post_id: savedPost.id,
        destination_id: ctaDest.id,
        placement_method: slot.cta.method,
        cta_text: slot.cta.cta_text,
      });

      // Increment counter
      // Increment placement counter
      await supabase
        .from("cta_destinations")
        .update({ total_placements: ((ctaDest as any).total_placements || 0) + 1 })
        .eq("id", ctaDest.id);
    }
  }

  return {
    status: "completed",
    post_id: savedPost?.id,
    slot_number: slotNumber,
    content_length: postContent.length,
    has_cta: !!slot.cta,
  };
}

function buildDefaultSystemPrompt(persona: any): string {
  const prohibitedWords = persona?.prohibited_words || [];

  return `あなたは「${persona?.display_name || "投稿者"}」としてThreadsに投稿するコンテンツを作成します。

キャラクター:
- 口調: ${persona?.tone_style || "カジュアル"}
- 年齢感: ${persona?.age_range || "不明"}
- 性別感: ${persona?.gender_feel || "不明"}
- 背景: ${persona?.background || "なし"}

ルール:
- 500文字以内（Threads制限）
- 禁止ワード: ${prohibitedWords.join(", ") || "なし"}
- AI臭い表現を避ける（emダッシュ、三点リーダの多用、「...」、定型的な締めくくり）
- 投稿本文のみを出力（説明や注釈は不要）`;
}

function buildGeneratePrompt(slot: any, narrativeThread: string, persona: any): string {
  return `# 投稿生成

## 今日のストーリー軸
${narrativeThread}

## このスロットの指示
- カテゴリ: ${slot.category}
- テーマ: ${slot.theme}
- フック: ${slot.hook_type}
- 内容指示: ${slot.content_directive}
- 感情入口: ${slot.emotional_target?.entry || "なし"}
- 感情出口: ${slot.emotional_target?.exit || "なし"}

## 制約
- 500文字以内
- ${persona?.display_name || "このキャラ"}の口調で書く
- フックの1行目で読者の手を止める
- 最後まで読ませる構成にする

投稿本文のみを出力してください。`;
}

function extractPostContent(text: string): string {
  // Remove markdown fences, thinking tags, etc.
  let content = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
    .replace(/^(投稿本文|出力|以下が|---).*/gm, "")
    .trim();

  // Truncate to 500 chars (Threads limit)
  if (content.length > 500) {
    content = content.slice(0, 497) + "...";
  }

  return content;
}

async function runQualityCheck(
  content: string,
  persona: any
): Promise<{ passed: boolean; issues: string[] }> {
  const issues: string[] = [];

  // Length check
  if (content.length > 500) {
    issues.push("500文字超過");
  }
  if (content.length < 30) {
    issues.push("短すぎる（30文字未満）");
  }

  // Prohibited words check
  const prohibitedWords = persona?.prohibited_words || [];
  for (const word of prohibitedWords) {
    if (content.includes(word)) {
      issues.push(`禁止ワード「${word}」を含む`);
    }
  }

  // AI smell check (basic)
  const aiSmellPatterns = [
    /——/g,     // em dash
    /\.{3,}/g,  // triple dots
    /…{2,}/g,   // multiple ellipsis
    /いかがでしょうか/g,
    /ではないでしょうか/g,
  ];

  for (const pattern of aiSmellPatterns) {
    if (pattern.test(content)) {
      issues.push(`AI臭パターン検出: ${pattern.source}`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
