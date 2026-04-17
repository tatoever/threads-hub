"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

interface DailyStat {
  date: string;
  follower_count: number | null;
  follower_delta: number | null;
  posts_published: number | null;
  total_views: number | null;
  total_engagement: number | null;
}

type Range = 30 | 60 | 90;

export function FollowerChart({ accountId }: { accountId: string }) {
  const [stats, setStats] = React.useState<DailyStat[]>([]);
  const [range, setRange] = React.useState<Range>(30);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/accounts/${accountId}/stats?days=${range}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setStats(Array.isArray(d) ? d : []);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, range]);

  const latest = stats[stats.length - 1];
  const first = stats[0];
  const totalDelta =
    latest && first && latest.follower_count != null && first.follower_count != null
      ? latest.follower_count - first.follower_count
      : null;
  const avgDaily =
    stats.length > 0
      ? Math.round(
          stats.reduce((s, d) => s + (d.follower_delta ?? 0), 0) / stats.length,
        )
      : 0;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">フォロワー推移</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            日次のフォロワー数推移
          </p>
        </div>
        <div className="flex gap-1">
          {([30, 60, 90] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                range === r
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-surface-hover",
              )}
            >
              {r}日
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="現在"
            value={latest?.follower_count ?? "—"}
            hint="フォロワー数"
          />
          <Stat
            label={`${range}日増減`}
            value={formatDelta(totalDelta)}
            tone={deltaTone(totalDelta)}
            icon={deltaIcon(totalDelta)}
          />
          <Stat
            label="日次平均"
            value={formatDelta(avgDaily)}
            tone={deltaTone(avgDaily)}
          />
        </div>

        {loading ? (
          <Skeleton className="h-36" />
        ) : stats.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
            <p>データ不足</p>
            <p className="text-xs mt-1">日次集計が蓄積されると表示されます</p>
          </div>
        ) : (
          <LineChart data={stats} />
        )}
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "success" | "danger" | "muted";
  icon?: React.ReactNode;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
      ? "text-danger"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums flex items-center gap-1", color)}>
        {icon}
        {value}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function LineChart({ data }: { data: DailyStat[] }) {
  const points = data
    .map((d, i) => ({ i, v: d.follower_count, date: d.date }))
    .filter((p): p is { i: number; v: number; date: string } => p.v != null);

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-36 text-sm text-muted-foreground">
        データ不足
      </div>
    );
  }

  const values = points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const W = 640;
  const H = 140;
  const PAD = 8;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const xs = points.map((_, i) =>
    PAD + (i / (points.length - 1)) * innerW,
  );
  const ys = points.map((p) =>
    PAD + innerH - ((p.v - min) / range) * innerH,
  );

  const path =
    points.map((_, i) => `${i === 0 ? "M" : "L"}${xs[i]},${ys[i]}`).join(" ");

  const area =
    `M${xs[0]},${H - PAD} ` +
    points.map((_, i) => `L${xs[i]},${ys[i]}`).join(" ") +
    ` L${xs[xs.length - 1]},${H - PAD} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-36 overflow-visible"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="flgrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#flgrad)" />
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.length <= 45 &&
        points.map((_, i) => (
          <circle
            key={i}
            cx={xs[i]}
            cy={ys[i]}
            r="2"
            fill="hsl(var(--primary))"
          />
        ))}
    </svg>
  );
}

function formatDelta(n: number | null) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "" : "±";
  return `${sign}${n.toLocaleString()}`;
}

function deltaTone(n: number | null) {
  if (n == null) return "muted" as const;
  if (n > 0) return "success" as const;
  if (n < 0) return "danger" as const;
  return "default" as const;
}

function deltaIcon(n: number | null) {
  if (n == null) return null;
  if (n > 0) return <TrendingUp className="size-4" />;
  if (n < 0) return <TrendingDown className="size-4" />;
  return <Minus className="size-4" />;
}
