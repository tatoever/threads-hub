import * as React from "react";
import Link from "next/link";
import { AlertTriangle, AlertCircle, Info, ArrowRight, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type Severity = "critical" | "warning" | "info";

const severityStyle: Record<Severity, { icon: React.ElementType; className: string; label: string }> = {
  critical: { icon: AlertCircle, className: "text-danger bg-danger-muted", label: "重大" },
  warning: { icon: AlertTriangle, className: "text-warning bg-warning-muted", label: "警告" },
  info: { icon: Info, className: "text-info bg-info-muted", label: "情報" },
};

export interface AlertItem {
  id: string;
  severity: Severity;
  alert_type: string;
  message: string;
  created_at: string;
}

export function AlertStack({ alerts }: { alerts: AlertItem[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">未解決アラート</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {alerts.length > 0 ? `${alerts.length}件が対応待ち` : "すべてクリア"}
          </p>
        </div>
        <Link
          href="/alerts"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          すべて
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
          <CheckCircle2 className="size-8 text-success mb-2" />
          <p>アラートはありません</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {alerts.map((alert) => {
            const style = severityStyle[alert.severity] ?? severityStyle.info;
            const Icon = style.icon;
            return (
              <li key={alert.id} className="px-5 py-3.5 flex items-start gap-3">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", style.className)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium truncate">{alert.alert_type}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatTime(alert.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                    {alert.message}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}
