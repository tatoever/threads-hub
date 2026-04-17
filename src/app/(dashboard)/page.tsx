import { createServiceClient } from "@/lib/supabase/client";
import { Users, Send, AlertTriangle, Activity } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  AccountMatrix,
  type MatrixRow,
  type PhaseCellState,
} from "@/components/dashboard/AccountMatrix";
import { AlertStack, type AlertItem } from "@/components/dashboard/AlertStack";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createServiceClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*, account_personas(*)")
    .order("created_at");

  const today = new Date().toISOString().split("T")[0];

  const { data: todayPosts } = await supabase
    .from("posts")
    .select("account_id, status")
    .gte("scheduled_at", `${today}T00:00:00`)
    .lt("scheduled_at", `${today}T23:59:59`);

  const { data: pipelineRuns } = await supabase
    .from("pipeline_runs")
    .select("account_id, phase, status")
    .eq("date", today);

  const { data: alerts } = await supabase
    .from("system_alerts")
    .select("id, severity, alert_type, message, created_at")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: dailyStats } = await supabase
    .from("account_daily_stats")
    .select("account_id, follower_count, follower_delta")
    .eq("date", today);

  const { data: todayComments } = await supabase
    .from("comments")
    .select("account_id, reply_status")
    .gte("created_at", `${today}T00:00:00`)
    .lt("created_at", `${today}T23:59:59`);

  const postsByAccount = new Map<string, { published: number; total: number }>();
  todayPosts?.forEach((p) => {
    const entry = postsByAccount.get(p.account_id) || { published: 0, total: 0 };
    entry.total++;
    if (p.status === "published") entry.published++;
    postsByAccount.set(p.account_id, entry);
  });

  const phasesByAccount = new Map<string, Record<string, PhaseCellState>>();
  pipelineRuns?.forEach((r) => {
    const current = phasesByAccount.get(r.account_id) ?? {};
    current[r.phase] = mapPhase(r.status);
    phasesByAccount.set(r.account_id, current);
  });

  const statsByAccount = new Map<string, { count: number | null; delta: number | null }>();
  dailyStats?.forEach((s: any) => {
    statsByAccount.set(s.account_id, {
      count: s.follower_count,
      delta: s.follower_delta,
    });
  });

  const commentsByAccount = new Map<string, { total: number; pending: number }>();
  todayComments?.forEach((c: any) => {
    const e = commentsByAccount.get(c.account_id) ?? { total: 0, pending: 0 };
    e.total++;
    if (c.reply_status === "pending") e.pending++;
    commentsByAccount.set(c.account_id, e);
  });

  const rows: MatrixRow[] = (accounts ?? []).map((account: any): MatrixRow => {
    const persona = Array.isArray(account.account_personas)
      ? account.account_personas[0]
      : account.account_personas;
    const posts = postsByAccount.get(account.id) ?? { published: 0, total: 0 };
    const stats = statsByAccount.get(account.id);
    const comments = commentsByAccount.get(account.id);
    return {
      id: account.id,
      name: account.name,
      displayName: persona?.display_name ?? null,
      slug: account.slug,
      genre: persona?.genre ?? null,
      status: account.status,
      published: posts.published,
      total: posts.total,
      target: account.daily_post_target ?? 0,
      phases: phasesByAccount.get(account.id) ?? {},
      followerCount: stats?.count ?? null,
      followerDelta: stats?.delta ?? null,
      commentsToday: comments?.total ?? 0,
      commentsPending: comments?.pending ?? 0,
    };
  });

  const activeCount = rows.filter((r) => r.status === "active").length;
  const totalTarget = rows.reduce((s, r) => s + r.target, 0);
  const totalPublished = rows.reduce((s, r) => s + r.published, 0);
  const totalPlanned = rows.reduce((s, r) => s + r.total, 0);
  const errorCount = alerts?.length ?? 0;

  const totalPhaseCells = rows.length * 5;
  const donePhaseCells = rows.reduce(
    (sum, r) => sum + Object.values(r.phases).filter((s) => s === "done").length,
    0,
  );
  const phaseProgress = totalPhaseCells > 0 ? (donePhaseCells / totalPhaseCells) * 100 : 0;

  const todayLabel = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <PageHeader
        title="ダッシュボード"
        description={`${todayLabel} · 10アカウント運用基盤の稼働状況`}
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="今日の投稿達成"
          value={
            <span>
              {totalPublished}
              <span className="text-muted-foreground text-base font-medium">
                /{totalTarget || totalPlanned || 0}
              </span>
            </span>
          }
          hint={totalPlanned > 0 ? `公開 ${totalPublished} / 予定 ${totalPlanned}` : "予定なし"}
          icon={Send}
          tone={
            totalTarget > 0 && totalPublished / totalTarget >= 1
              ? "success"
              : totalTarget > 0 && totalPublished / totalTarget >= 0.5
              ? "default"
              : "warning"
          }
          progress={totalTarget > 0 ? (totalPublished / totalTarget) * 100 : 0}
        />
        <KpiCard
          label="アクティブ"
          value={
            <span>
              {activeCount}
              <span className="text-muted-foreground text-base font-medium">
                /{rows.length}
              </span>
            </span>
          }
          hint="稼働中アカウント"
          icon={Users}
          tone="info"
        />
        <KpiCard
          label="パイプライン進捗"
          value={`${Math.round(phaseProgress)}%`}
          hint={`${donePhaseCells} / ${totalPhaseCells} フェーズ完了`}
          icon={Activity}
          tone="default"
          progress={phaseProgress}
        />
        <KpiCard
          label="未解決アラート"
          value={errorCount}
          hint={errorCount > 0 ? "確認が必要" : "クリア"}
          icon={AlertTriangle}
          tone={errorCount > 0 ? "danger" : "success"}
        />
      </section>

      <AccountMatrix rows={rows} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AlertStack alerts={(alerts ?? []) as AlertItem[]} />
        </div>
        <QuickLinks />
      </div>
    </div>
  );
}

function mapPhase(status: string): PhaseCellState {
  switch (status) {
    case "completed":
      return "done";
    case "processing":
      return "running";
    case "failed":
      return "error";
    case "pending":
      return "waiting";
    default:
      return "idle";
  }
}

function QuickLinks() {
  const links = [
    { href: "/accounts/new", label: "新規アカウント追加", desc: "Threads認証から開始" },
    { href: "/pipeline", label: "パイプライン詳細", desc: "フェーズごとの実行状況" },
    { href: "/settings", label: "システム設定", desc: "通知・手動トリガー" },
  ];
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold">クイックアクセス</h2>
      </div>
      <ul className="divide-y divide-border">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="flex flex-col px-5 py-3.5 hover:bg-muted/40 transition-colors"
            >
              <span className="text-sm font-medium">{l.label}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{l.desc}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
