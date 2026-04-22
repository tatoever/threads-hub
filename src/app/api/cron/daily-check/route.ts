import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * Daily health check cron
 * - token_expiring: 7日以内に期限切れのトークン
 * - no_post_published: 昨日 publish が0件のアカ
 * - comment_backlog: 24h超え未返信コメントが閾値超え
 * - zero_engagement: 3日連続で likes+replies+reposts=0
 *
 * alert_configs.enabled=false の種別は、アラート発行をスキップする設計。
 *
 * 呼び出し: Vercel Cron で毎日 JST 6:00 JST 相当に実行
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const yesterdayStart = new Date(now.getTime() - 24 * 3600 * 1000);
  yesterdayStart.setUTCHours(0, 0, 0, 0);
  const todayStartUtc = new Date(now);
  todayStartUtc.setUTCHours(0, 0, 0, 0);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600 * 1000);

  // === alert_configs を一括取得（enabled チェック用）===
  const { data: configs } = await supabase
    .from("alert_configs")
    .select("alert_type, enabled, default_severity");
  const cfgMap = new Map<string, { enabled: boolean; severity: string }>();
  for (const c of configs ?? []) {
    cfgMap.set(c.alert_type, { enabled: c.enabled, severity: c.default_severity });
  }
  const isEnabled = (t: string) => cfgMap.get(t)?.enabled !== false;
  const severityOf = (t: string) => cfgMap.get(t)?.severity ?? "warning";

  const emit = async (account_id: string | null, alert_type: string, message: string) => {
    if (!isEnabled(alert_type)) return;
    // 同日同種の重複抑制
    const { data: existing } = await supabase
      .from("system_alerts")
      .select("id")
      .eq("alert_type", alert_type)
      .eq("account_id", account_id as any)
      .eq("resolved", false)
      .gte("created_at", todayStartUtc.toISOString())
      .limit(1);
    if (existing && existing.length > 0) return;

    await supabase.from("system_alerts").insert({
      account_id,
      alert_type,
      severity: severityOf(alert_type),
      message,
    });
  };

  // === active アカのみ対象 ===
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, slug, name, account_personas(display_name)")
    .eq("status", "active");

  const summary = { token_expiring: 0, no_post_published: 0, comment_backlog: 0, zero_engagement: 0 };

  // === 1. token_expiring ===
  if (isEnabled("token_expiring")) {
    const { data: tokens } = await supabase
      .from("account_tokens")
      .select("account_id, token_expires_at, status")
      .eq("status", "active")
      .lte("token_expires_at", sevenDaysLater.toISOString());
    for (const t of tokens ?? []) {
      const days = Math.ceil((new Date(t.token_expires_at).getTime() - now.getTime()) / 86400000);
      await emit(
        t.account_id,
        "token_expiring",
        `Threadsアクセストークンが ${days}日後 (${new Date(t.token_expires_at).toISOString().slice(0, 10)}) に期限切れ。Meta Developer Portalで再取得が必要。`
      );
      summary.token_expiring++;
    }
  }

  // === 2. no_post_published (昨日0件) ===
  if (isEnabled("no_post_published")) {
    for (const acc of accounts ?? []) {
      const { data: pubs } = await supabase
        .from("posts")
        .select("id")
        .eq("account_id", acc.id)
        .eq("status", "published")
        .gte("published_at", yesterdayStart.toISOString())
        .lt("published_at", todayStartUtc.toISOString())
        .limit(1);
      if (!pubs || pubs.length === 0) {
        await emit(
          acc.id,
          "no_post_published",
          `${acc.slug}: 昨日1件もpublishされませんでした。meeting/generate/publish のどこで止まったか要確認。`
        );
        summary.no_post_published++;
      }
    }
  }

  // === 3. comment_backlog (24h超え未返信が10件以上) ===
  if (isEnabled("comment_backlog")) {
    const threshold = 10;
    for (const acc of accounts ?? []) {
      const { data: pending } = await supabase
        .from("comments")
        .select("id")
        .eq("account_id", acc.id)
        .eq("reply_status", "pending")
        .lt("created_at", new Date(now.getTime() - 24 * 3600 * 1000).toISOString());
      if ((pending?.length ?? 0) >= threshold) {
        await emit(
          acc.id,
          "comment_backlog",
          `${acc.slug}: 24h以上未返信のコメントが${pending?.length}件あります。管理画面でdraft返信を確認してください。`
        );
        summary.comment_backlog++;
      }
    }
  }

  // === 4. zero_engagement (直近3日公開分で反応0が続く) ===
  if (isEnabled("zero_engagement")) {
    for (const acc of accounts ?? []) {
      const { data: recent } = await supabase
        .from("posts")
        .select("id")
        .eq("account_id", acc.id)
        .eq("status", "published")
        .gte("published_at", threeDaysAgo.toISOString())
        .lte("published_at", now.toISOString());
      if (!recent || recent.length < 3) continue; // 3日で3件未満は判定対象外

      const { data: metrics } = await supabase
        .from("post_analytics")
        .select("views, likes, replies, reposts")
        .in("post_id", recent.map(r => r.id));
      const totalViews = (metrics ?? []).reduce((s, m) => s + (m.views || 0), 0);
      const totalEngagement = (metrics ?? []).reduce(
        (s, m) => s + (m.likes || 0) + (m.replies || 0) + (m.reposts || 0),
        0
      );
      // views はあるが engagement ゼロ
      if (totalViews > 0 && totalEngagement === 0) {
        await emit(
          acc.id,
          "zero_engagement",
          `${acc.slug}: 直近3日間、views=${totalViews} あるのに likes/replies/reposts がすべて0。コンテンツと読者のミスマッチ疑い。`
        );
        summary.zero_engagement++;
      }
    }
  }

  return NextResponse.json({ ok: true, ran_at: now.toISOString(), summary });
}
