import { createServiceClient } from "@/lib/supabase/client";
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const supabase = createServiceClient();

  const { data: alerts } = await supabase
    .from("system_alerts")
    .select("*, accounts(name, account_personas(display_name))")
    .order("resolved", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(50);

  const unresolvedCount = alerts?.filter((a: any) => !a.resolved).length || 0;

  return (
    <div className="p-6 space-y-6 max-w-[1100px]">
      <PageHeader
        title="アラート"
        description="システムアラートと通知の履歴"
        actions={
          unresolvedCount > 0 ? (
            <Badge variant="danger">未解決 {unresolvedCount}件</Badge>
          ) : (
            <Badge variant="success">
              <CheckCircle2 className="size-3" />
              クリア
            </Badge>
          )
        }
      />

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
            return (
              <AlertCard
                key={alert.id}
                alert={alert}
                accountName={persona?.display_name || account?.name}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlertCard({
  alert,
  accountName,
}: {
  alert: any;
  accountName?: string;
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
          <span className="font-medium text-sm">{alert.alert_type}</span>
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
