import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export interface TripleKpiCardProps {
  label: string;
  icon: React.ElementType;
  today: number;
  yesterday: number;
  total: number;
  /** delta表現か否か: true → 今日/前日は +/- 記号付き */
  asDelta?: boolean;
  /** total のサブラベル (例: "現在の累計") */
  totalLabel?: string;
  tone?: "default" | "success" | "info" | "warning" | "danger";
}

function formatValue(v: number, asDelta: boolean): string {
  if (!asDelta) return v.toLocaleString();
  if (v === 0) return "0";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toLocaleString()}`;
}

function trendColor(today: number, yesterday: number): string {
  if (today > yesterday) return "text-success";
  if (today < yesterday) return "text-danger";
  return "text-muted-foreground";
}

function TrendIcon({ today, yesterday }: { today: number; yesterday: number }) {
  if (today > yesterday) return <TrendingUp className="size-3" />;
  if (today < yesterday) return <TrendingDown className="size-3" />;
  return <Minus className="size-3" />;
}

export function TripleKpiCard({
  label,
  icon: Icon,
  today,
  yesterday,
  total,
  asDelta = false,
  totalLabel = "トータル",
  tone = "default",
}: TripleKpiCardProps) {
  const toneBg: Record<NonNullable<TripleKpiCardProps["tone"]>, string> = {
    default: "bg-muted text-muted-foreground",
    success: "bg-success-muted text-success",
    info: "bg-info-muted text-info",
    warning: "bg-warning-muted text-warning",
    danger: "bg-danger-muted text-danger",
  };

  return (
    <Card className="p-5 flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <span className={cn("flex size-8 items-center justify-center rounded-md", toneBg[tone])}>
          <Icon className="size-4" />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </header>

      <div className="space-y-1.5">
        {/* 本日 */}
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-14">本日</span>
          <span className={cn("text-2xl font-semibold tabular-nums", trendColor(today, yesterday))}>
            {formatValue(today, asDelta)}
          </span>
          <span className={cn("inline-flex items-center text-xs ml-1", trendColor(today, yesterday))}>
            <TrendIcon today={today} yesterday={yesterday} />
          </span>
        </div>

        {/* 前日 */}
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-14">前日</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatValue(yesterday, asDelta)}
          </span>
        </div>

        {/* トータル */}
        <div className="flex items-baseline gap-2 pt-2 border-t border-border">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-14">{totalLabel}</span>
          <span className="text-base font-semibold tabular-nums">
            {total.toLocaleString()}
          </span>
        </div>
      </div>
    </Card>
  );
}
