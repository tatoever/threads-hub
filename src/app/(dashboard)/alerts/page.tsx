import { createServiceClient } from "@/lib/supabase/client";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Settings, CheckCheck, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

type AlertConfig = {
  alert_type: string;
  enabled: boolean;
  default_severity: "critical" | "warning" | "info";
  display_label: string;
  description: string;
  when_it_fires: string;
  why_it_matters: string;
  recommended_action: string;
  implementation_status: "active" | "planned";
  sort_order: number;
};

export default async function AlertsPage() {
  const supabase = createServiceClient();

  const [{ data: alerts }, { data: configs }] = await Promise.all([
    supabase
      .from("system_alerts")
      .select("*, accounts(name, account_personas(display_name))")
      .order("resolved", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("alert_configs")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  const unresolvedCount = alerts?.filter((a: any) => !a.resolved).length || 0;
  const configList = (configs as AlertConfig[] | null) ?? [];

  // 未解決アラートを alert_type ごとにカウント
  const unresolvedByType = new Map<string, number>();
  for (const a of alerts ?? []) {
    if (!a.resolved) {
      unresolvedByType.set(a.alert_type, (unresolvedByType.get(a.alert_type) ?? 0) + 1);
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-[1200px]">
      <PageHeader
        title="アラート"
        description="システムアラート履歴 と 種別ON/OFF設定"
        actions={
          <div className="flex items-center gap-2">
            {unresolvedCount > 0 ? (
              <Badge variant="danger">未解決 {unresolvedCount}件</Badge>
            ) : (
              <Badge variant="success">
                <CheckCircle2 className="size-3" />
                クリア
              </Badge>
            )}
            {unresolvedCount > 0 && (
              <form action="/api/alerts/resolve-all" method="POST">
                <Button type="submit" variant="outline" size="sm">
                  <CheckCheck className="size-3.5" /> 全て解決済みにする
                </Button>
              </form>
            )}
          </div>
        }
      />

      {/* ========== アラート種別 ON/OFF 設定 ========== */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">アラート種別の設定</h2>
          <span className="text-xs text-muted-foreground">
            発火のON/OFF切替、種別ごとの一括クリア
          </span>
        </div>
        <div className="rounded-md border border-border divide-y divide-border">
          {configList.map((c) => (
            <ConfigRow
              key={c.alert_type}
              config={c}
              unresolvedCount={unresolvedByType.get(c.alert_type) ?? 0}
            />
          ))}
        </div>
      </section>

      {/* ========== 履歴 ========== */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">アラート履歴（最新100件）</h2>
        </div>

        {!alerts || alerts.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="size-10 text-success mb-3" />
            <p className="font-medium">アラートはありません</p>
            <p className="text-sm text-muted-foreground mt-1">
              すべてのシステムが正常に稼働しています
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert: any) => {
              const account = alert.accounts;
              const persona = Array.isArray(account?.account_personas)
                ? account.account_personas[0]
                : account?.account_personas;
              const cfg = configList.find((c) => c.alert_type === alert.alert_type);
              return (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  accountName={persona?.display_name || account?.name}
                  displayLabel={cfg?.display_label}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ConfigRow({
  config,
  unresolvedCount,
}: {
  config: AlertConfig;
  unresolvedCount: number;
}) {
  const sevColor =
    config.default_severity === "critical"
      ? "text-danger"
      : config.default_severity === "warning"
        ? "text-warning"
        : "text-info";
  const SevIcon =
    config.default_severity === "critical"
      ? AlertCircle
      : config.default_severity === "warning"
        ? AlertTriangle
        : Info;

  return (
    <details className="group">
      <summary className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/40 transition-colors list-none">
        <SevIcon className={cn("size-4 shrink-0", sevColor)} />
        <span className="font-medium text-sm flex-1 min-w-0">
          <span className="font-mono text-xs text-muted-foreground mr-2">{config.alert_type}</span>
          {config.display_label}
        </span>
        {config.implementation_status === "planned" ? (
          <Badge variant="secondary" title="実装予定（ONにしても現時点では発火しません）">
            <Clock className="size-3" /> 準備中
          </Badge>
        ) : (
          <Badge variant="success">稼働中</Badge>
        )}
        {unresolvedCount > 0 && (
          <Badge variant="danger">未解決 {unresolvedCount}</Badge>
        )}
        <form action={`/api/alerts/config/${config.alert_type}/toggle`} method="POST">
          <Button
            type="submit"
            variant={config.enabled ? "default" : "outline"}
            size="sm"
            className="min-w-[72px]"
          >
            {config.enabled ? "ON" : "OFF"}
          </Button>
        </form>
        <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="px-4 pb-4 pt-2 border-t border-border bg-surface-subtle space-y-3 text-sm">
        <DetailRow label="概要" value={config.description} />
        <DetailRow label="いつ発火するか" value={config.when_it_fires} />
        <DetailRow label="なぜ重要か" value={config.why_it_matters} />
        <DetailRow label="推奨アクション" value={config.recommended_action} />
        {unresolvedCount > 0 && (
          <div className="pt-2 border-t border-border">
            <form action={`/api/alerts/resolve-type/${config.alert_type}`} method="POST">
              <Button type="submit" variant="outline" size="sm">
                <CheckCheck className="size-3.5" /> この種別を一括で解決済みにする ({unresolvedCount}件)
              </Button>
            </form>
          </div>
        )}
      </div>
    </details>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground flex-1">{value}</span>
    </div>
  );
}

function AlertCard({
  alert,
  accountName,
  displayLabel,
}: {
  alert: any;
  accountName?: string;
  displayLabel?: string;
}) {
  const severity = (alert.severity ?? "info") as "critical" | "warning" | "info";
  const severityMap: Record<
    string,
    { icon: React.ElementType; color: string; bg: string; label: string }
  > = {
    critical: {
      icon: AlertCircle,
      color: "text-danger",
      bg: "bg-danger-muted",
      label: "重大",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-warning",
      bg: "bg-warning-muted",
      label: "警告",
    },
    info: {
      icon: Info,
      color: "text-info",
      bg: "bg-info-muted",
      label: "情報",
    },
  };
  const s = severityMap[severity];
  const Icon = s.icon;

  return (
    <Card
      className={cn(
        "p-5 flex items-start gap-4",
        alert.resolved && "opacity-60",
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-md", s.bg)}>
        <Icon className={cn("size-5", s.color)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{displayLabel || alert.alert_type}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{alert.alert_type}</span>
          <Badge
            variant={
              severity === "critical"
                ? "danger"
                : severity === "warning"
                ? "warning"
                : "info"
            }
          >
            {s.label}
          </Badge>
          {accountName && (
            <span className="text-xs text-muted-foreground">· {accountName}</span>
          )}
        </div>
        <p className="text-sm text-foreground mt-1">{alert.message}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {new Date(alert.created_at).toLocaleString("ja-JP", {
            timeZone: "Asia/Tokyo",
          })}
        </p>
      </div>
      <div className="shrink-0">
        {alert.resolved ? (
          <Badge variant="secondary">
            <CheckCircle2 className="size-3" />
            解決済
          </Badge>
        ) : (
          <form action={`/api/alerts/${alert.id}/resolve`} method="POST">
            <Button type="submit" variant="outline" size="sm">
              解決済みにする
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
