/**
 * Sub-A: Publish - 予定時刻が来た投稿をThreads APIで公開
 */

import { supabase } from "../utils/supabase";
import { notifyDiscord } from "../utils/notify";
import { insertAlert } from "../utils/alert";
import type { TaskData } from "../task-executor";

export async function runPublish(task: TaskData): Promise<Record<string, any>> {
  const { account_id } = task;

  // 1. Load credentials
  const { data: token } = await supabase
    .from("account_tokens")
    .select("access_token")
    .eq("account_id", account_id)
    .eq("status", "active")
    .single();

  const { data: account } = await supabase
    .from("accounts")
    .select("threads_user_id")
    .eq("id", account_id)
    .single();

  if (!token?.access_token || !account?.threads_user_id) {
    throw new Error("Missing Threads credentials");
  }

  // 2. Get approved posts that are due
  const now = new Date().toISOString();
  const { data: duePosts } = await supabase
    .from("posts")
    .select("*")
    .eq("account_id", account_id)
    .eq("status", "approved")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(3); // Max 3 per run to avoid rate limits

  if (!duePosts || duePosts.length === 0) {
    return { status: "no_due_posts" };
  }

  // E2 (2026-04-28 凍結事案対策): 同IPからの同時刻 publish を防ぐ
  // 直近60秒以内に「他アカ」が published になっているなら 60-180秒待機
  // → CIB (Coordinated Inauthentic Behavior) シグナル回避
  const sixtyAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { data: recentPub } = await supabase
    .from("posts")
    .select("id, account_id, published_at")
    .gte("published_at", sixtyAgo)
    .neq("account_id", account_id)
    .order("published_at", { ascending: false })
    .limit(1);
  if (recentPub && recentPub.length > 0) {
    const waitMs = 60_000 + Math.floor(Math.random() * 120_000); // 60-180秒
    console.log(
      `[publish] 他アカ直近 publish 検出 (${recentPub[0].account_id.slice(0, 8)}) → ${Math.round(waitMs / 1000)}秒待機 (E2 ジッタ)`
    );
    await new Promise((r) => setTimeout(r, waitMs));
  }

  const results: any[] = [];

  for (const post of duePosts) {
    try {
      // Publish main post
      const publishResult = await publishToThreads(
        account.threads_user_id,
        token.access_token,
        post.content
      );

      // Update post status
      await supabase
        .from("posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          threads_post_id: publishResult.id,
        })
        .eq("id", post.id);

      // Publish reply_1 (CTA tree) if exists
      if (post.reply_1 && publishResult.id) {
        await sleep(3000); // Wait before reply
        try {
          await publishReplyToThreads(
            account.threads_user_id,
            token.access_token,
            publishResult.id,
            post.reply_1
          );
        } catch (replyErr: any) {
          console.warn(`[publish] Reply 1 failed for post ${post.id}: ${replyErr.message}`);
        }
      }

      // Publish reply_2 if exists
      if (post.reply_2 && publishResult.id) {
        await sleep(3000);
        try {
          await publishReplyToThreads(
            account.threads_user_id,
            token.access_token,
            publishResult.id,
            post.reply_2
          );
        } catch (replyErr: any) {
          console.warn(`[publish] Reply 2 failed for post ${post.id}: ${replyErr.message}`);
        }
      }

      results.push({ post_id: post.id, threads_id: publishResult.id, status: "published" });

      // Rate limit spacing between posts
      await sleep(5000);
    } catch (err: any) {
      // Mark as failed
      await supabase
        .from("posts")
        .update({ status: "failed" })
        .eq("id", post.id);

      // Alert 振り分け: 429 は rate_limit_hit、それ以外は api_error
      const msg = String(err?.message ?? err ?? "");
      const isRateLimit = /\b429\b|rate[\s_-]?limit|too[\s_-]?many[\s_-]?requests/i.test(msg);
      await insertAlert({
        account_id,
        alert_type: isRateLimit ? "rate_limit_hit" : "api_error",
        severity: "warning",
        message: isRateLimit
          ? `Threads API rate limit hit: ${msg}`
          : `Post publish failed: ${msg}`,
      });

      results.push({ post_id: post.id, status: "failed", error: err.message });
    }
  }

  return { status: "completed", published: results };
}

async function publishToThreads(
  userId: string,
  accessToken: string,
  text: string
): Promise<{ id: string }> {
  // Step 1: Create container
  const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "TEXT", text, access_token: accessToken }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Create container failed: ${JSON.stringify(err)}`);
  }

  const { id: containerId } = await createRes.json();

  // Wait for container to be ready
  await sleep(2000);

  // Step 2: Publish
  const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });

  if (!publishRes.ok) {
    const err = await publishRes.json();
    throw new Error(`Publish failed: ${JSON.stringify(err)}`);
  }

  return publishRes.json();
}

async function publishReplyToThreads(
  userId: string,
  accessToken: string,
  replyToId: string,
  text: string
): Promise<{ id: string }> {
  const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "TEXT",
      text,
      reply_to_id: replyToId,
      access_token: accessToken,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Reply container failed: ${JSON.stringify(err)}`);
  }

  const { id: containerId } = await createRes.json();
  await sleep(2000);

  const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });

  if (!publishRes.ok) {
    const err = await publishRes.json();
    throw new Error(`Reply publish failed: ${JSON.stringify(err)}`);
  }

  return publishRes.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
