import * as React from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp, TrendingDown, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatusDot, statusToTone } from "@/components/shell/StatusDot";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

export type PhaseCellState = "done" | "running" | "waiting" | "error" | "idle";

export const PHASE_LABELS: { key: string; label: string }[] = [
  { key: "research", label: "Research" },
  { key: "intelligence", label: "Intel" },
  { key: "community", label: "Community" },
  { key: "meeting", label: "Meeting" },
  { key: "generate", label: "Generate" },
];

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
  phases: Record<string, PhaseCellState>;
  followerDelta?: number | null;
  followerCount?: number | null;
  commentsToday?: number;
  commentsPending?: number;
}

const cellStyles: Record<PhaseCellState, string> = {
  done: "bg-success-muted text-success ring-success/20",
  running: "bg-info-muted text-info ring-info/20 animate-pulse",
  waiting: "bg-muted text-muted-foreground ring-transparent",
  error: "bg-danger-muted text-danger ring-danger/20",
  idle: "bg-transparent text-muted-foreground/40 ring-transparent",
};

const cellLabel: Record<PhaseCellState, string> = {
  done: "完了",
  running: "実行中",
  waiting: "待機",
  error: "失敗",
  idle: "未実行",
};

function PhaseCell({ state, label }: { state: PhaseCellState; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center justify-center size-7 rounded-md text-[10px] font-medium ring-1 transition-all",
            cellStyles[state],
          )}
        >
          {state === "idle" ? "—" : state === "done" ? "✓" : state === "error" ? "!" : "·"}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-medium">{label}</span>
        <span className="ml-1 text-muted-foreground">{cellLabel[state]}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function AccountMatrix({ rows }: { rows: MatrixRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">アカウント稼働マトリクス</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            全{rows.length}アカウントの投稿進捗とパイプライン状況
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
              <th className="text-right font-medium text-xs uppercase tracking-wider text-muted-foreground py-2.5 px-2">
                フォロワー
              </th>
              <th className="text-right font-medium text-xs uppercase tracking-wider text-muted-foreground py-2.5 px-2">
                コメント
              </th>
              {PHASE_LABELS.map((p) => (
                <th
                  key={p.key}
                  className="text-center font-medium text-xs uppercase tracking-wider text-muted-foreground py-2.5 px-1"
                >
                  {p.label}
                </th>
              ))}
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
                  <td className="py-3 px-2 text-right">
                    <FollowerCell
                      count={row.followerCount}
                      delta={row.followerDelta}
                    />
                  </td>
                  <td className="py-3 px-2 text-right">
                    <CommentCell
                      total={row.commentsToday}
                      pending={row.commentsPending}
                    />
                  </td>
                  {PHASE_LABELS.map((p) => (
                    <td key={p.key} className="py-3 px-1 text-center">
                      <PhaseCell
                        state={row.phases[p.key] ?? "idle"}
                        label={p.label}
                      />
                    </td>
                  ))}
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
                  colSpan={PHASE_LABELS.length + 6}
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

function FollowerCell({
  count,
  delta,
}: {
  count: number | null | undefined;
  delta: number | null | undefined;
}) {
  if (count == null && (delta == null || delta === 0)) {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }
  const Icon = delta == null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : null;
  const deltaColor =
    delta == null || delta === 0
      ? "text-muted-foreground"
      : delta > 0
      ? "text-success"
      : "text-danger";
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-xs font-semibold tabular-nums">
        {count != null ? count.toLocaleString() : "—"}
      </span>
      {delta != null && delta !== 0 && (
        <span className={cn("text-[10px] tabular-nums inline-flex items-center gap-0.5", deltaColor)}>
          {Icon && <Icon className="size-2.5" />}
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
    </div>
  );
}

function CommentCell({
  total,
  pending,
}: {
  total: number | undefined;
  pending: number | undefined;
}) {
  if (!total && !pending) {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }
  return (
    <div className="inline-flex items-center gap-1.5 text-xs tabular-nums">
      <MessageSquare className="size-3 text-muted-foreground" />
      <span className="font-medium">{total ?? 0}</span>
      {pending ? (
        <span className="text-warning">({pending})</span>
      ) : null}
    </div>
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
