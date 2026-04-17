import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type Tone = "default" | "success" | "warning" | "danger" | "info";

const toneColor: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

const toneIconBg: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  danger: "bg-danger-muted text-danger",
  info: "bg-info-muted text-info",
};

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  progress?: number;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  progress,
}: KpiCardProps) {
  return (
    <Card className="p-5 relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", toneColor[tone])}>
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        {Icon && (
          <span className={cn("flex size-9 items-center justify-center rounded-lg", toneIconBg[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      {typeof progress === "number" && (
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              tone === "warning"
                ? "bg-warning"
                : tone === "danger"
                ? "bg-danger"
                : tone === "success"
                ? "bg-success"
                : "bg-primary",
            )}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </Card>
  );
}
