import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BarChart3,
  Eye,
  Clock,
  MousePointerClick,
  Globe,
  Smartphone,
  Monitor,
  LinkIcon,
  ArrowLeft,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getArticleAnalytics } from "@/lib/articles/analytics";
import { ClickHeatmap } from "./ClickHeatmap";

export const dynamic = "force-dynamic";

export default async function ArticleAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data: article } = await supabase
    .from("articles")
    .select("id, slug, title, status, account_id, accounts(slug, name, account_personas(display_name))")
    .eq("id", id)
    .maybeSingle();
  if (!article) notFound();

  const accountSlug = Array.isArray((article as any).accounts)
    ? (article as any).accounts[0]?.slug
    : (article as any).accounts?.slug;

  const analytics = await getArticleAnalytics(id);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href={`/articles/${id}/edit`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="size-4" /> 編集に戻る
          </Link>
          <Badge variant={article.status === "published" ? "success" : "secondary"}>
            {article.status === "published" ? "公開中" : "下書き"}
          </Badge>
        </div>
        {accountSlug && article.status === "published" && (
          <a
            href={`https://note-sub.top/${accountSlug}/${article.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground font-mono"
          >
            note-sub.top/{accountSlug}/{article.slug} ↗
          </a>
        )}
      </header>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 className="size-5 text-muted-foreground" />
          分析: {article.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          記事に対する閲覧・滞在・クリックの集計
        </p>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="総PV"
          value={analytics.totalViews.toLocaleString()}
          icon={Eye}
        />
        <KpiCard
          label="ユニーク"
          value={analytics.uniqueSessions.toLocaleString()}
          icon={Eye}
        />
        <KpiCard
          label="平均滞在"
          value={analytics.avgDwellMs !== null ? formatDuration(analytics.avgDwellMs) : "-"}
          icon={Clock}
        />
        <KpiCard
          label="CTA クリック"
          value={`${analytics.ctaClicks} (${(analytics.ctr * 100).toFixed(1)}%)`}
          icon={MousePointerClick}
        />
      </section>

      {/* Scroll reach */}
      <Card className="p-5">
        <h2 className="text-base font-semibold mb-4">スクロール到達率</h2>
        <div className="space-y-2">
          {([
            ["25%", analytics.scrollReach.p25],
            ["50%", analytics.scrollReach.p50],
            ["75%", analytics.scrollReach.p75],
            ["100%", analytics.scrollReach.p100],
          ] as Array<[string, number]>).map(([label, ratio]) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-12 text-xs font-mono text-muted-foreground">{label}</div>
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, ratio * 100).toFixed(1)}%` }}
                />
              </div>
              <div className="w-14 text-right text-xs text-muted-foreground tabular-nums">
                {(ratio * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Referrers */}
        <Card className="p-5">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Globe className="size-4 text-muted-foreground" /> 流入元
          </h2>
          {analytics.topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだデータがありません</p>
          ) : (
            <ul className="space-y-2">
              {analytics.topReferrers.map((r) => (
                <li key={r.referrer} className="flex items-center gap-3">
                  <span className="flex-1 text-sm truncate">{r.referrer}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Devices */}
        <Card className="p-5">
          <h2 className="text-base font-semibold mb-4">デバイス</h2>
          <div className="space-y-2">
            <DeviceRow
              label="モバイル"
              icon={Smartphone}
              count={analytics.devices.mobile}
              total={analytics.totalViews}
            />
            <DeviceRow
              label="デスクトップ"
              icon={Monitor}
              count={analytics.devices.desktop}
              total={analytics.totalViews}
            />
            <DeviceRow
              label="その他"
              icon={Globe}
              count={analytics.devices.other}
              total={analytics.totalViews}
            />
          </div>
        </Card>
      </div>

      {/* Short links */}
      <Card className="p-5">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <LinkIcon className="size-4 text-muted-foreground" /> 短縮URL（アフィリ等）
        </h2>
        {analytics.shortLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">この記事に紐付いた短縮URLはまだありません</p>
        ) : (
          <div className="space-y-2">
            {analytics.shortLinks.map((s) => (
              <div
                key={s.slug}
                className="flex items-center gap-3 py-2 border-b border-border last:border-b-0"
              >
                <a
                  href={`https://note-sub.top/go/${s.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-primary hover:underline"
                >
                  /go/{s.slug}
                </a>
                <span className="flex-1 text-xs text-muted-foreground truncate">
                  → {s.target_url}
                </span>
                <span className="text-sm tabular-nums font-semibold">{s.click_count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Heatmap */}
      <Card className="p-5">
        <h2 className="text-base font-semibold mb-2">クリックヒートマップ</h2>
        <p className="text-xs text-muted-foreground mb-4">
          記事内でクリックされた位置（x/y = 画面幅/ページ高さに対する比率）
        </p>
        <ClickHeatmap points={analytics.heatmapPoints} />
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function DeviceRow({
  label,
  icon: Icon,
  count,
  total,
}: {
  label: string;
  icon: React.ElementType;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 flex items-center gap-2 text-sm">
        <Icon className="size-3.5 text-muted-foreground" /> {label}
      </div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary/60" style={{ width: `${pct.toFixed(1)}%` }} />
      </div>
      <div className="w-14 text-right text-xs text-muted-foreground tabular-nums">
        {count} ({pct.toFixed(0)}%)
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}秒`;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return `${min}分${s}秒`;
}
