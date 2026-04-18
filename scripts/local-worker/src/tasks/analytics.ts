/**
 * Sub-C: Analytics - エンゲージメント取得→集計
 */

import { supabase } from "../utils/supabase";
import type { TaskData } from "../task-executor";

export async function runAnalytics(task: TaskData): Promise<Record<string, any>> {
  const { account_id } = task;

  // 1. Load credentials
  const { data: token } = await supabase
    .from("account_tokens")
    .select("access_token")
    .eq("account_id", account_id)
    .eq("status", "active")
    .single();

  if (!token?.access_token) {
    return { status: "skipped", reason: "no_token" };
  }

  // 2. Get published posts from last 3 days that need analytics update
  // Threads API の insights は publish 直後は未生成（24時間経過で取得可能になる）
  // → published_at が 24h 前〜3日前のみを対象にして無駄な API 呼び出しを減らす
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const { data: posts } = await supabase
    .from("posts")
    .select("id, threads_post_id")
    .eq("account_id", account_id)
    .eq("status", "published")
    .not("threads_post_id", "is", null)
    .gte("published_at", threeDaysAgo.toISOString())
    .lte("published_at", twentyFourHoursAgo.toISOString())
    .limit(30);

  if (!posts || posts.length === 0) {
    return { status: "no_posts_to_analyze" };
  }

  // 3. Fetch insights for each post
  let updated = 0;

  for (const post of posts) {
    try {
      const insights = await fetchPostInsights(post.threads_post_id, token.access_token);

      if (insights) {
        const engagementRate = insights.views > 0
          ? (insights.likes + insights.replies + insights.reposts) / insights.views
          : 0;

        await supabase.from("post_analytics").upsert(
          {
            account_id,
            post_id: post.id,
            views: insights.views,
            likes: insights.likes,
            replies: insights.replies,
            reposts: insights.reposts,
            engagement_rate: Math.round(engagementRate * 10000) / 10000,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "post_id" }
        );

        // Also update post.metrics
        await supabase
          .from("posts")
          .update({ metrics: insights })
          .eq("id", post.id);

        updated++;
      }
    } catch (err: any) {
      console.warn(`[analytics] Failed for post ${post.id}: ${err.message}`);
    }

    // Rate limit spacing
    await new Promise((r) => setTimeout(r, 500));
  }

  // 4. Update daily stats
  const today = new Date().toISOString().split("T")[0];

  const { data: todayPosts } = await supabase
    .from("posts")
    .select("id")
    .eq("account_id", account_id)
    .eq("status", "published")
    .gte("published_at", `${today}T00:00:00`)
    .lt("published_at", `${today}T23:59:59`);

  const { data: todayAnalytics } = await supabase
    .from("post_analytics")
    .select("views, likes, replies, reposts")
    .eq("account_id", account_id)
    .in("post_id", (todayPosts || []).map((p: any) => p.id));

  const totalViews = (todayAnalytics || []).reduce((s: number, a: any) => s + (a.views || 0), 0);
  const totalEngagement = (todayAnalytics || []).reduce(
    (s: number, a: any) => s + (a.likes || 0) + (a.replies || 0) + (a.reposts || 0),
    0
  );

  const { data: todayCta } = await supabase
    .from("cta_placements")
    .select("id")
    .eq("account_id", account_id)
    .gte("placed_at", `${today}T00:00:00`);

  await supabase.from("account_daily_stats").upsert({
    account_id,
    date: today,
    posts_published: todayPosts?.length || 0,
    total_views: totalViews,
    total_engagement: totalEngagement,
    cta_placements_count: todayCta?.length || 0,
    pipeline_success: true,
  });

  // 5. Shadow ban detection
  if (todayPosts && todayPosts.length >= 3 && totalViews === 0) {
    await supabase.from("system_alerts").insert({
      account_id,
      alert_type: "shadowban_suspect",
      severity: "critical",
      message: `${todayPosts.length}件公開済みで閲覧数ゼロ。シャドウBAN疑い。`,
    });
  }

  return { status: "completed", posts_updated: updated };
}

async function fetchPostInsights(
  threadsPostId: string,
  accessToken: string
): Promise<{ views: number; likes: number; replies: number; reposts: number } | null> {
  try {
    const url = `https://graph.threads.net/v1.0/${threadsPostId}/insights?metric=views,likes,replies,reposts&access_token=${accessToken}`;
    const res = await fetch(url);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "?");
      console.warn(
        `[analytics] insights fetch failed for post ${threadsPostId}: ${res.status} ${errBody.slice(0, 300)}`
      );
      return null;
    }

    const data = await res.json();
    const metrics: Record<string, number> = {};
    for (const entry of data.data || []) {
      metrics[entry.name] = entry.values?.[0]?.value ?? 0;
    }

    console.log(
      `[analytics] insights for ${threadsPostId}: views=${metrics.views ?? 0} likes=${metrics.likes ?? 0} replies=${metrics.replies ?? 0} reposts=${metrics.reposts ?? 0}`
    );

    return {
      views: metrics.views ?? 0,
      likes: metrics.likes ?? 0,
      replies: metrics.replies ?? 0,
      reposts: metrics.reposts ?? 0,
    };
  } catch (err: any) {
    console.warn(`[analytics] insights fetch exception for ${threadsPostId}: ${err?.message || err}`);
    return null;
  }
}
