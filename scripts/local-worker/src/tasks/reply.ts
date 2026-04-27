/**
 * Sub-B: Reply - pending コメントに対して返信を生成、必要なら送信
 *
 * 流れ:
 * 1. pending コメントを読む（最大 REPLY_MAX_PER_RUN 件）
 * 2. account_personas（tone_style / background / reply_rules 等）を読む
 * 3. systemPrompt / userPrompt を組み立て（reply/build-prompt.ts）
 * 4. callClaude で生成
 * 5. 品質チェック（reply/quality-check.ts）→ NG なら1回リジェネ
 * 6. reply_rules.auto_send が true なら Threads API で送信し reply_status='sent'
 *    false なら reply_status='approved' で保存（手動送信待ち）
 */

import { supabase } from "../utils/supabase";
import { callClaude, type ModelType } from "../utils/claude-cli";
import { publishToThreads } from "../utils/threads-api";
import type { TaskData } from "../task-executor";
import { buildSystemPrompt, buildUserPrompt, inferToneHint, type PersonaRow, type ReplyRules } from "../reply/build-prompt";
import { checkReplyQuality, formatReasonsForRegen } from "../reply/quality-check";
import { getRecentReplyOpenings } from "../reply/anti-repeat";
import { getJstDayContext } from "../utils/day-context";

const REPLY_MAX_PER_RUN = Number(process.env.REPLY_MAX_PER_RUN || 5);
const MAX_REPLY_CHARS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runReply(task: TaskData): Promise<Record<string, any>> {
  const { account_id } = task;

  // 1. pending コメントを取得
  const { data: pendingComments } = await supabase
    .from("comments")
    .select("*, posts(content, threads_post_id)")
    .eq("account_id", account_id)
    .eq("reply_status", "pending")
    .order("created_at", { ascending: true })
    .limit(REPLY_MAX_PER_RUN);

  if (!pendingComments || pendingComments.length === 0) {
    return { status: "no_pending_comments" };
  }

  // 2. persona / prompt 設定を取得
  const { data: persona } = await supabase
    .from("account_personas")
    .select("*")
    .eq("account_id", account_id)
    .single();

  if (!persona) {
    return { status: "no_persona", comments: pendingComments.length };
  }

  const { data: promptRow } = await supabase
    .from("account_prompts")
    .select("system_prompt, model_preference")
    .eq("account_id", account_id)
    .eq("phase", "reply")
    .eq("is_active", true)
    .maybeSingle();

  const rules: ReplyRules = persona.reply_rules || {};
  const model: ModelType = (promptRow?.model_preference as ModelType) || "sonnet";
  const systemPrompt = promptRow?.system_prompt || buildSystemPrompt(persona as PersonaRow);
  const autoSend = rules.auto_send === true;

  // 3. アカウント認証情報（auto_send 用、先に一度だけ取得）
  let threadsAuth: { userId: string; accessToken: string } | null = null;
  if (autoSend) {
    const [{ data: tok }, { data: acc }] = await Promise.all([
      supabase.from("account_tokens").select("access_token").eq("account_id", account_id).eq("status", "active").maybeSingle(),
      supabase.from("accounts").select("threads_user_id").eq("id", account_id).maybeSingle(),
    ]);
    if (tok?.access_token && acc?.threads_user_id) {
      threadsAuth = { userId: acc.threads_user_id, accessToken: tok.access_token };
    }
  }

  // 4. antiRepeat: 直近の書き出しを取得
  const avoidOpenings = await getRecentReplyOpenings(account_id, 5);

  const results: any[] = [];

  for (const comment of pendingComments) {
    try {
      const postContent = comment.posts?.content ?? null;

      // 初回生成
      let userPrompt = buildUserPrompt({
        postContent,
        commentContent: comment.content || "",
        commentAuthorUsername: comment.author_username,
        commentCreatedAt: comment.created_at,
        avoidOpenings,
      });

      let { text: generated } = await callClaude(userPrompt, { model, systemPrompt });
      let replyText = sanitize(generated, MAX_REPLY_CHARS);

      // 品質チェック (2026-04-25: commenterTone と contextType を渡す)
      const dayCtx = getJstDayContext();
      const tone = inferToneHint(comment.content || "");
      const commenterTone =
        tone.label === "カジュアル" ? "casual" :
        tone.label === "フォーマル" ? "formal" : "mid";
      const qcOptions = {
        maxChars: MAX_REPLY_CHARS,
        speechLevel: rules.speech_level,
        firstPersonToken: rules.first_person_when_used,
        firstPersonStrict: rules.first_person_strict,
        accountProhibitedWords: persona.prohibited_words || [],
        isOffDay: dayCtx.isOffDay,
        dayOfWeekJa: dayCtx.dayOfWeekJa,
        contextType: "comment_reply" as const,
        commenterTone: commenterTone as "casual" | "mid" | "formal",
      };
      let check = checkReplyQuality(replyText, qcOptions);

      // NGなら1回だけリジェネ
      if (!check.ok) {
        const regenUser = buildUserPrompt({
          postContent,
          commentContent: comment.content || "",
          commentAuthorUsername: comment.author_username,
          commentCreatedAt: comment.created_at,
          avoidOpenings,
          regenerationFeedback: formatReasonsForRegen(check.reasons),
        });
        const regen = await callClaude(regenUser, { model, systemPrompt });
        const regenText = sanitize(regen.text, MAX_REPLY_CHARS);
        const regenCheck = checkReplyQuality(regenText, qcOptions);
        if (regenCheck.ok) {
          replyText = regenText;
          check = regenCheck;
        } else {
          // リジェネも NG → approved にせず skipped に
          await supabase
            .from("comments")
            .update({
              reply_text: regenText, // 参考用に最後の生成を保存
              reply_status: "skipped",
            })
            .eq("id", comment.id);
          results.push({
            comment_id: comment.id,
            status: "skipped_quality",
            reasons: regenCheck.reasons,
          });
          continue;
        }
      }

      // 5. 送信 or 承認待ち保存
      if (autoSend && threadsAuth && comment.threads_comment_id) {
        try {
          const sendResult = await publishToThreads({
            userId: threadsAuth.userId,
            accessToken: threadsAuth.accessToken,
            text: replyText,
            replyToId: comment.threads_comment_id,
          });
          await supabase
            .from("comments")
            .update({
              reply_text: replyText,
              reply_status: "sent",
              replied: true,
            })
            .eq("id", comment.id);
          results.push({ comment_id: comment.id, status: "sent", threads_id: sendResult.id });
          // rate limit
          const delayMs = 25_000 + Math.floor(Math.random() * 20_000); // 25〜45秒
          await sleep(delayMs);
        } catch (sendErr: any) {
          // 送信失敗 → approved で保存（後から手動送信 or リトライ可）
          await supabase
            .from("comments")
            .update({
              reply_text: replyText,
              reply_status: "approved",
            })
            .eq("id", comment.id);
          results.push({ comment_id: comment.id, status: "send_failed", error: sendErr.message });
        }
      } else {
        // auto_send=false or auth missing → approved（手動送信待ち）
        await supabase
          .from("comments")
          .update({
            reply_text: replyText,
            reply_status: "approved",
            replied: true, // 既に返信文は生成済み
          })
          .eq("id", comment.id);
        results.push({ comment_id: comment.id, status: "approved_for_manual", dry_run: !autoSend });
      }

      // antiRepeat に即反映（同一ランでの連打被り防止）
      avoidOpenings.unshift(replyText.slice(0, 15).trim());
      if (avoidOpenings.length > 5) avoidOpenings.pop();
    } catch (err: any) {
      await supabase
        .from("comments")
        .update({ reply_status: "skipped" })
        .eq("id", comment.id);
      results.push({ comment_id: comment.id, status: "failed", error: err.message });
    }
  }

  return {
    status: "completed",
    processed: results.length,
    results,
    auto_send: autoSend,
  };
}

function sanitize(raw: string, maxChars: number): string {
  let t = raw.trim();
  // 接頭辞除去
  t = t.replace(/^(返信[:：]|Reply[:：])\s*/i, "");
  // 先頭末尾の引用符除去
  t = t.replace(/^[「『"“]|[」』"”]$/g, "");
  // 過剰な改行を2つまでに
  t = t.replace(/\n{3,}/g, "\n\n");
  // 文字数制限（三点リーダで切らない）
  if (t.length > maxChars) t = t.slice(0, maxChars);
  return t.trim();
}
