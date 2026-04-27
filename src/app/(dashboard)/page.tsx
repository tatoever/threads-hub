import { createServiceClient } from "@/lib/supabase/client";
import { TrendingUp, MessageSquare, Eye, MousePointerClick } from "lucide-react";
import { TripleKpiCard } from "@/components/dashboard/TripleKpiCard";
import {
  AccountMatrix,
  type MatrixRow,
} from "@/components/dashboard/AccountMatrix";
import { AlertStack, type AlertItem } from "@/components/dashboard/AlertStack";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { fetchDashboardKpi } from "@/lib/dashboard/kpi";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createServiceClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*, account_personas(*)")
    .order("created_at");

  const accountIds = (accounts ?? []).map((a: any) => a.id);

  // 今日の投稿（既存マトリクスに残す「今日の投稿」列用）
  const today = new Date().toISOString().split("T")[0];
  const { data: todayPosts } = await supabase
    .from("posts")
    .select("account_id, status")
    .gte("scheduled_at", `${today}T00:00:00`)
    .lt("scheduled_at", `${today}T23:59:59`);

  const { data: alerts } = await supabase
    .from("system_alerts")
    .select("id, severity, alert_type, message, created_at")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(5);

  // 4指標 x 3軸 を一括取得
  const kpi = await fetchDashboardKpi(accountIds);

  const postsByAccount = new Map<string, { published: number; total: number }>();
  todayPosts?.forEach((p) => {
    const entry = postsByAccount.get(p.account_id) || { published: 0, total: 0 };
    entry.total++;
    if (p.status === "published") entry.published++;
    postsByAccount.set(p.account_id, entry);
  });

  const emptyTriple = { today: 0, yesterday: 0, total: 0 };

  const rows: MatrixRow[] = (accounts ?? []).map((account: any): MatrixRow => {
    const persona = Array.isArray(account.account_personas)
      ? account.account_personas[0]
      : account.account_personas;
    const posts = postsByAccount.get(account.id) ?? { published: 0, total: 0 };
    const accKpi = kpi.byAccount.get(account.id);
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
      followerDelta: accKpi?.followerDelta ?? emptyTriple,
      comments: accKpi?.comments ?? emptyTriple,
      noteViews: accKpi?.noteViews ?? emptyTriple,
      urlClicks: accKpi?.urlClicks ?? emptyTriple,
    };
  });

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

      {/* ========== 4指標 x 3軸 KPI（全アカ合計） ========== */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TripleKpiCard
          label="フォロワー推移"
          icon={TrendingUp}
          today={kpi.totals.followerDelta.today}
          yesterday={kpi.totals.followerDelta.yesterday}
          total={kpi.totals.followerDelta.total}
          asDelta
          totalLabel="累計"
          tone="info"
        />
        <TripleKpiCard
          label="コメント数"
          icon={MessageSquare}
          today={kpi.totals.comments.today}
          yesterday={kpi.totals.comments.yesterday}
          total={kpi.totals.comments.total}
          totalLabel="累計"
          tone="default"
        />
        <TripleKpiCard
          label="note遷移数"
          icon={Eye}
          today={kpi.totals.noteViews.today}
          yesterday={kpi.totals.noteViews.yesterday}
          total={kpi.totals.noteViews.total}
          totalLabel="累計"
          tone="success"
        />
        <TripleKpiCard
          label="URLクリック数"
          icon={MousePointerClick}
          today={kpi.totals.urlClicks.today}
          yesterday={kpi.totals.urlClicks.yesterday}
          total={kpi.totals.urlClicks.total}
          totalLabel="累計"
          tone="warning"
        />
      </section>

      {/* ========== アカウント稼働マトリクス ========== */}
      <AccountMatrix rows={rows} />

      {/* ========== アラート + クイックアクセス ========== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AlertStack alerts={(alerts ?? []) as AlertItem[]} />
        </div>
        <QuickLinks />
      </div>
    </div>
  );
}

function QuickLinks() {
  const links = [
    { href: "/accounts/new", label: "新規アカウント追加", desc: "Threads認証から開始" },
    { href: "/pipeline", label: "パイプライン詳細", desc: "Research / Intel / Community / Meeting / Generate 状況" },
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
