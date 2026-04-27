import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * 朝の健康診断 (JST 07:00)
 * 毎朝 pipeline / generate 完了後に全アカの健康状態を総合チェック。
 * 結果を daily_health_summaries に1レコード保存 + 🔴 ならアラート発火 + Discord通知。
 *
 * チェック項目:
 *   1. Meeting完了率
 *   2. Generate実行状況
 *   3. 本日の投稿予定
 *   4. 失敗タスク
 *   5. 未解決アラート
 *   6. トークン期限
 */
export async function GET(req: NextRequest) {
  // Vercel Cron は Authorization: Bearer $CRON_SECRET
  // 管理画面からの手動実行は threads-hub-session cookie でOK (middleware 通過済み)
  const authHeader = req.headers.get("authorization");
  const hasSession = req.cookies.get("threads-hub-session")?.value;
  const validBearer = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!validBearer && !hasSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  const todayDate = jstNow.toISOString().slice(0, 10);
  const todayStart = new Date(todayDate + "T00:00:00+09:00").toISOString();
  const todayEnd = new Date(todayDate + "T23:59:59+09:00").toISOString();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 3600 * 1000);

  // ========== アカウント基本情報 ==========
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, slug, status, daily_post_target, warmup_daily_target, warmup_started_at")
    .eq("status", "active");
  const activeAccounts = accounts ?? [];

  // 各アカの本日の期待投稿数 (warmup中なら warmup_daily_target、卒業後は daily_post_target)
  const expectedByAccount = new Map<string, number>();
  for (const a of activeAccounts) {
    // warmup_started_at が直近7日以内なら warmup_daily_target を使う
    let target = a.daily_post_target ?? 0;
    if (a.warmup_started_at) {
      const elapsed = (now.getTime() - new Date(a.warmup_started_at).getTime()) / 86400000;
      if (elapsed < 7 && a.warmup_daily_target) {
        target = a.warmup_daily_target;
      }
    }
    expectedByAccount.set(a.id, target);
  }

  // ========== 1. Meeting 完了率 ==========
  const { data: meetingRuns } = await supabase
    .from("pipeline_runs")
    .select("account_id, status")
    .eq("date", todayDate)
    .eq("phase", "meeting");
  const completedMeetings = (meetingRuns ?? []).filter(r => r.status === "completed");
  const failedMeetingAccounts: string[] = [];
  for (const a of activeAccounts) {
    const run = (meetingRuns ?? []).find(r => r.account_id === a.id);
    if (!run || run.status !== "completed") failedMeetingAccounts.push(a.slug);
  }
  const meetingRate = activeAccounts.length > 0
    ? (completedMeetings.length / activeAccounts.length)
    : 0;

  // ========== 2. Generate 実行状況 (本日のposts) ==========
  const { data: todayPosts } = await supabase
    .from("posts")
    .select("id, account_id, status, scheduled_at")
    .gte("scheduled_at", todayStart)
    .lt("scheduled_at", todayEnd);
  const generatedCount = (todayPosts ?? []).length;
  const publishedCount = (todayPosts ?? []).filter(p => p.status === "published").length;
  // 各アカの期待値合計 (warmup_daily_target or daily_post_target)
  const expectedTotal = Array.from(expectedByAccount.values()).reduce((s, n) => s + n, 0);

  // ========== 3. 本日の投稿予定 ==========
  const scheduledCount = (todayPosts ?? []).filter(
    p => p.status === "approved" || p.status === "pending_review" || p.status === "published"
  ).length;

  // ========== 4. 失敗タスク ==========
  const { data: failedTasks } = await supabase
    .from("task_queue")
    .select("task_type, account_id, error_message, created_at")
    .eq("status", "failed")
    .gte("created_at", todayStart)
    .limit(20);
  const failedTasksCount = failedTasks?.length ?? 0;

  // ========== 5. 未解決アラート ==========
  const { data: unresolvedAlerts } = await supabase
    .from("system_alerts")
    .select("id, alert_type, severity")
    .eq("resolved", false);
  const criticalAlerts = (unresolvedAlerts ?? []).filter(a => a.severity === "critical").length;
  const warningAlerts = (unresolvedAlerts ?? []).filter(a => a.severity === "warning").length;

  // ========== 6. トークン期限 ==========
  const { data: tokens } = await supabase
    .from("account_tokens")
    .select("account_id, token_expires_at, status")
    .eq("status", "active");
  let minExpiryDays = 9999;
  let tokenExpiringCount = 0;
  let tokenCriticalCount = 0;
  for (const t of tokens ?? []) {
    if (!t.token_expires_at) continue;
    const days = Math.ceil((new Date(t.token_expires_at).getTime() - now.getTime()) / 86400000);
    if (days < minExpiryDays) minExpiryDays = days;
    if (days <= 7) tokenExpiringCount++;
    if (days <= 3) tokenCriticalCount++;
  }

  // ========== 総合ステータス判定 ==========
  type Overall = "green" | "yellow" | "red";
  const redReasons: string[] = [];
  const yellowReasons: string[] = [];
  let hasRed = false;
  let hasYellow = false;

  if (meetingRate < 0.8) {
    hasRed = true;
    redReasons.push(`Meeting完了率 ${Math.round(meetingRate * 100)}% (${activeAccounts.length - completedMeetings.length}アカ失敗)`);
  } else if (meetingRate < 1.0) {
    hasYellow = true;
    yellowReasons.push(`Meeting完了率 ${Math.round(meetingRate * 100)}% (${activeAccounts.length - completedMeetings.length}アカ失敗)`);
  }

  if (failedTasksCount >= 3) {
    hasRed = true;
    redReasons.push(`失敗タスク ${failedTasksCount}件`);
  } else if (failedTasksCount > 0) {
    hasYellow = true;
    yellowReasons.push(`失敗タスク ${failedTasksCount}件`);
  }

  if (tokenCriticalCount > 0) {
    hasRed = true;
    redReasons.push(`${tokenCriticalCount}アカのトークンが3日以内に期限切れ`);
  } else if (tokenExpiringCount > 0) {
    hasYellow = true;
    yellowReasons.push(`${tokenExpiringCount}アカのトークンが7日以内に期限切れ`);
  }

  if ((unresolvedAlerts?.length ?? 0) >= 20) {
    hasYellow = true;
    yellowReasons.push(`未解決アラート ${unresolvedAlerts?.length}件`);
  }

  const overall: Overall = hasRed ? "red" : hasYellow ? "yellow" : "green";

  // ========== checks 構造化 ==========
  const checks = {
    meeting: {
      label: "Meeting完了",
      status: meetingRate >= 1.0 ? "green" : meetingRate >= 0.8 ? "yellow" : "red",
      value: `${completedMeetings.length}/${activeAccounts.length} アカ`,
      detail: failedMeetingAccounts.length > 0 ? `失敗: ${failedMeetingAccounts.join(", ")}` : undefined,
    },
    generate: {
      label: "Generate実行",
      status: generatedCount >= expectedTotal ? "green" : generatedCount >= expectedTotal * 0.7 ? "yellow" : "red",
      value: `${generatedCount}/${expectedTotal} 件 生成済み`,
    },
    scheduled: {
      label: "本日の投稿予定",
      status: scheduledCount > 0 ? "green" : "yellow",
      value: `${scheduledCount} 件 (公開済み ${publishedCount})`,
    },
    failed_tasks: {
      label: "失敗タスク",
      status: failedTasksCount === 0 ? "green" : failedTasksCount < 3 ? "yellow" : "red",
      value: `${failedTasksCount}件`,
      detail: (failedTasks ?? []).slice(0, 5).map(t => `${t.task_type} (${t.error_message?.slice(0, 80) ?? "?"})`),
    },
    alerts: {
      label: "未解決アラート",
      status: (unresolvedAlerts?.length ?? 0) < 10 ? "green" : (unresolvedAlerts?.length ?? 0) < 20 ? "yellow" : "yellow",
      value: `${unresolvedAlerts?.length ?? 0}件 (critical: ${criticalAlerts}, warning: ${warningAlerts})`,
    },
    token: {
      label: "トークン期限",
      status: tokenCriticalCount > 0 ? "red" : tokenExpiringCount > 0 ? "yellow" : "green",
      value: `最短 ${minExpiryDays}日後`,
      detail: tokenCriticalCount > 0 ? `${tokenCriticalCount}アカが3日以内` : undefined,
    },
  };

  // ========== Claude相談用 Markdown ==========
  const emojiFor = (s: string) => ({ green: "✅", yellow: "🟡", red: "🔴" }[s] ?? "⚪");
  const summary_markdown = [
    `朝の健康診断 (${todayDate} 07:00 JST)`,
    `総合: ${overall === "red" ? "🔴 要相談" : overall === "yellow" ? "🟡 要注意" : "🟢 正常"}`,
    "",
    ...Object.entries(checks).map(([_, c]: [string, any]) => {
      const lines = [`${emojiFor(c.status)} ${c.label}: ${c.value}`];
      if (c.detail) {
        if (Array.isArray(c.detail)) lines.push(...c.detail.map((d: string) => `  - ${d}`));
        else lines.push(`  - ${c.detail}`);
      }
      return lines.join("\n");
    }),
    "",
    overall === "red" ? "これをClaudeに相談したいです。" : overall === "yellow" ? "気になる箇所あれば後で確認したいです。" : "特に問題なし。",
  ].join("\n");

  // ========== 保存 (upsert today) ==========
  const action_required = overall !== "green";
  await supabase
    .from("daily_health_summaries")
    .upsert({
      date: todayDate,
      overall,
      checks,
      summary_markdown,
      action_required,
    }, { onConflict: "date" });

  // ========== 🔴 なら system_alerts + Discord 通知 ==========
  if (overall === "red") {
    // alert 発火 (同日重複抑制)
    const { data: existing } = await supabase
      .from("system_alerts")
      .select("id")
      .eq("alert_type", "morning_health_red")
      .eq("resolved", false)
      .gte("created_at", todayStart)
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabase.from("system_alerts").insert({
        account_id: null,
        alert_type: "morning_health_red",
        severity: "critical",
        message: `朝の健康診断が🔴 要相談です。理由: ${redReasons.join(" / ")}`,
      });
    }

    // Discord webhook 通知
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `🔴 **朝の健康診断: 要相談** (${todayDate})\n\n${summary_markdown}`,
          }),
        });
      } catch {}
    }
  }

  return NextResponse.json({
    ok: true,
    date: todayDate,
    overall,
    action_required,
    checks,
    red_reasons: redReasons,
    yellow_reasons: yellowReasons,
  });
}

/** 手動実行用 POST (管理画面からのトリガー) */
export const POST = GET;
