import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusDot, statusToTone } from "@/components/shell/StatusDot";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { TripleMetric } from "@/lib/dashboard/kpi";

export interface MatrixRow {
  id: string;
  name: string;
  displayName?: string | null;
  slug: string;
  genre?: string | null;
  status: string;
  published: number;
  total: number;
  target: number;

  // 4指標 x 3軸
  followerDelta: TripleMetric; // today/yesterday=delta, total=現在累計
  comments: TripleMetric;
  noteViews: TripleMetric;
  urlClicks: TripleMetric;
}

function formatDelta(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? `+${n.toLocaleString()}` : `${n.toLocaleString()}`;
}

function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function deltaColor(today: number, yesterday: number): string {
  if (today > yesterday) return "text-success";
  if (today < yesterday) return "text-danger";
  return "text-foreground";
}

/**
 * 1セル表示: 「本日(前日) / 総」形式
 */
function MetricCell({
  metric,
  asDelta = false,
}: {
  metric: TripleMetric;
  asDelta?: boolean;
}) {
  const todayStr = asDelta ? formatDelta(metric.today) : formatNum(metric.today);
  const ydayStr = asDelta ? formatDelta(metric.yesterday) : formatNum(metric.yesterday);
  const totalStr = formatNum(metric.total);

  const empty = metric.today === 0 && metric.yesterday === 0 && metric.total === 0;
  if (empty) {
    return <span className="text-xs text-muted-foreground/40">—</span>;
  }

  return (
    <div className="flex flex-col items-end leading-tight tabular-nums">
      <span className={cn("text-sm font-semibold", deltaColor(metric.today, metric.yesterday))}>
        {todayStr}
        <span className="text-[10px] text-muted-foreground font-normal ml-1">
          ({ydayStr})
        </span>
      </span>
      <span className="text-[10px] text-muted-foreground">
        / {totalStr}
      </span>
    </div>
  );
}

export function AccountMatrix({ rows }: { rows: MatrixRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">アカウント稼働マトリクス</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            全{rows.length}アカウント · 本日(前日) / 累計
          </p>
        </div>
        <Link
          href="/pipeline"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          詳細
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-xs uppercase tracking-wider text-muted-foreground px-5 py-2.5">
                アカウント
              </th>
              <th className="text-left font-medium text-xs uppercase tracking-wider text-muted-foreground py-2.5 px-2">
                ステータス
              </th>
              <th className="text-left font-medium text-xs uppercase tracking-wider text-muted-foreground py-2.5 px-2">
                今日の投稿
              </th>
              <th className="text-right font-medium text-xs uppercase tracking-wider text-muted-foreground py-2.5 px-3">
                フォロワー
              </th>
              <th className="text-right font-medium text-xs uppercase tracking-wider text-muted-foreground py-2.5 px-3">
                コメント
              </th>
              <th className="text-right font-medium text-xs uppercase tracking-wider text-muted-foreground py-2.5 px-3">
                note遷移
              </th>
              <th className="text-right font-medium text-xs uppercase tracking-wider text-muted-foreground py-2.5 px-3">
                URLクリック
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pct = row.target > 0 ? (row.published / row.target) * 100 : 0;
              return (
                <tr
                  key={row.id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors group"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/accounts/${row.id}`}
                      className="flex items-center gap-2.5 min-w-0"
                    >
                      <StatusDot tone={statusToTone(row.status)} />
                      <div className="min-w-0">
                        <div className="font-medium truncate group-hover:text-primary transition-colors">
                          {row.displayName || row.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          @{row.slug}
                          {row.genre ? ` · ${row.genre}` : ""}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="py-3 px-2">
                    <StatusBadgeInline status={row.status} />
                  </td>
                  <td className="py-3 px-2 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-xs font-medium">
                        {row.published}
                        <span className="text-muted-foreground">/{row.target}</span>
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            pct >= 100
                              ? "bg-success"
                              : pct >= 50
                              ? "bg-primary"
                              : "bg-warning",
                          )}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <MetricCell metric={row.followerDelta} asDelta />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <MetricCell metric={row.comments} />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <MetricCell metric={row.noteViews} />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <MetricCell metric={row.urlClicks} />
                  </td>
                  <td className="pr-5">
                    <Link
                      href={`/accounts/${row.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="text-center text-muted-foreground py-10"
                >
                  アカウントがまだありません。
                  <Link
                    href="/accounts/new"
                    className="text-primary hover:underline ml-1"
                  >
                    追加する
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StatusBadgeInline({ status }: { status: string }) {
  const map: Record<string, { variant: "success" | "warning" | "secondary" | "danger"; label: string }> = {
    active: { variant: "success", label: "稼働中" },
    testing: { variant: "warning", label: "テスト" },
    setup: { variant: "secondary", label: "設定中" },
    paused: { variant: "danger", label: "停止中" },
  };
  const entry = map[status] ?? { variant: "secondary" as const, label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
