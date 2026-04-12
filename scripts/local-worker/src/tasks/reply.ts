/**
 * Sub-B: Reply - コメント検出→返信生成→返信投稿
 */

import { supabase } from "../utils/supabase";
import { callClaude, type ModelType } from "../utils/claude-cli";
import type { TaskData } from "../task-executor";

export async function runReply(task: TaskData): Promise<Record<string, any>> {
  const { account_id } = task;

  // 1. Load pending comments
  const { data: pendingComments } = await supabase
    .from("comments")
    .select("*")
    .eq("account_id", account_id)
    .eq("reply_status", "pending")
    .order("created_at", { ascending: true })
    .limit(10);

  if (!pendingComments || pendingComments.length === 0) {
    return { status: "no_pending_comments" };
  }

  // 2. Load persona + reply prompt
  const { data: persona } = await supabase
    .from("account_personas")
    .select("*")
    .eq("account_id", account_id)
    .single();

  const { data: replyPromptRow } = await supabase
    .from("account_prompts")
    .select("system_prompt, model_preference")
    .eq("account_id", account_id)
    .eq("phase", "reply")
    .eq("is_active", true)
    .single();

  const replyModel: ModelType = (replyPromptRow?.model_preference as ModelType) || "sonnet";
  const systemPrompt = replyPromptRow?.system_prompt || buildDefaultReplyPrompt(persona);

  // 3. Generate replies
  const results: any[] = [];

  for (const comment of pendingComments) {
    try {
      const prompt = `コメントに返信してください。

コメント: @${comment.author_username}: "${comment.content}"

返信文のみを出力（200文字以内）。`;

      const result = await callClaude(prompt, {
        model: replyModel,
        systemPrompt,
      });

      let replyText = result.text.trim();
      if (replyText.length > 200) {
        replyText = replyText.slice(0, 197) + "...";
      }

      // Save reply text
      await supabase
        .from("comments")
        .update({
          reply_text: replyText,
          reply_status: "approved", // Auto-approve for now
          replied: true,
        })
        .eq("id", comment.id);

      results.push({ comment_id: comment.id, status: "generated" });
    } catch (err: any) {
      await supabase
        .from("comments")
        .update({ reply_status: "skipped" })
        .eq("id", comment.id);

      results.push({ comment_id: comment.id, status: "failed", error: err.message });
    }
  }

  return { status: "completed", processed: results.length };
}

function buildDefaultReplyPrompt(persona: any): string {
  return `あなたは「${persona?.display_name || "投稿者"}」としてコメントに返信します。

キャラクター:
- 口調: ${persona?.tone_style || "カジュアル"}
- 禁止: ${(persona?.prohibited_words || []).join(", ") || "なし"}

ルール:
- 200文字以内
- 元投稿のキーワードを全返信に連呼しない
- 同じフレーズの使い回し禁止
- AI臭い表現を避ける
- 返信文のみを出力`;
}
