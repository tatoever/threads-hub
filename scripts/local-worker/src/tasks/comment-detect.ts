/**
 * Comment Detector - 直近 published 投稿からコメントを取得して comments テーブルに upsert
 *
 * Threads Graph API: GET /{media_id}/conversation
 * 対象: 過去14日以内に publish 済みの投稿
 * バッチ: 1サイクルで max 15投稿分取得（レート制限考慮）
 * 重複防止: threads_comment_id UNIQUE で自動防止
 */

import { supabase } from "../utils/supabase";
import { fetchConversation } from "../utils/threads-api";
import type { TaskData } from "../task-executor";

const LOOKBACK_DAYS = 14;
const MAX_POSTS_PER_RUN = Number(process.env.COMMENT_DETECT_MAX_POSTS || 15);

export async function runCommentDetect(task: TaskData): Promise<Record<string, any>> {
  const { account_id } = task;

  const [{ data: token }, { data: account }] = await Promise.all([
    supabase
      .from("account_tokens")
      .select("access_token")
      .eq("account_id", account_id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("accounts")
      .select("threads_user_id, threads_username")
      .eq("id", account_id)
      .maybeSingle(),
  ]);

  if (!token?.access_token || !account?.threads_user_id) {
    return { status: "missing_credentials" };
  }

  // 自分のツリー返信 (reply_1 / reply_2) が conversation で返ってくるので除外する
  const selfUsername: string | null = account.threads_username || null;

  // 過去14日以内に published の投稿を取得
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, threads_post_id, published_at")
    .eq("account_id", account_id)
    .eq("status", "published")
    .not("threads_post_id", "is", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(MAX_POSTS_PER_RUN);

  if (!posts || posts.length === 0) {
    return { status: "no_published_posts" };
  }

  let detectedTotal = 0;
  let insertedTotal = 0;
  const perPost: any[] = [];

  for (const post of posts) {
    if (!post.threads_post_id) continue;

    try {
      const rawComments = await fetchConversation({
        mediaId: post.threads_post_id,
        accessToken: token.access_token,
      });

      // 自分のツリー返信 (reply_1 / reply_2) を除外
      // Threads API の conversation は自アカのreplyも含めて返すため
      const comments = selfUsername
        ? rawComments.filter((c) => c.username && c.username !== selfUsername)
        : rawComments;
      const selfFiltered = rawComments.length - comments.length;

      detectedTotal += comments.length;

      if (comments.length === 0) {
        perPost.push({ post_id: post.id, detected: 0, inserted: 0, self_filtered: selfFiltered });
        continue;
      }

      // upsert（threads_comment_id UNIQUE で重複はスキップ）
      const rows = comments.map((c) => ({
        account_id,
        post_id: post.id,
        threads_comment_id: c.id,
        author_username: c.username || null,
        content: c.text || "",
        reply_status: "pending" as const,
        replied: false,
        created_at: c.timestamp ? new Date(c.timestamp).toISOString() : new Date().toISOString(),
      }));

      const { data: inserted, error } = await supabase
        .from("comments")
        .upsert(rows, {
          onConflict: "threads_comment_id",
          ignoreDuplicates: true,
        })
        .select("id");

      if (error) {
        perPost.push({ post_id: post.id, detected: comments.length, error: error.message, self_filtered: selfFiltered });
      } else {
        const count = inserted?.length || 0;
        insertedTotal += count;
        perPost.push({ post_id: post.id, detected: comments.length, inserted: count, self_filtered: selfFiltered });
      }
    } catch (err: any) {
      perPost.push({ post_id: post.id, error: err.message });
    }
  }

  return {
    status: "completed",
    posts_checked: posts.length,
    detected_total: detectedTotal,
    inserted_total: insertedTotal,
    per_post: perPost,
  };
}
