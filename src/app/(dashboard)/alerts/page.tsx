import { createServiceClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const supabase = createServiceClient();

  // Get all alerts (unresolved first, then recent resolved)
  const { data: alerts } = await supabase
    .from("system_alerts")
    .select("*, accounts(name, account_personas(display_name))")
    .order("resolved", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(50);

  const unresolvedCount = alerts?.filter((a: any) => !a.resolved).length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">アラート</h1>
        {unresolvedCount > 0 && (
          <span className="px-3 py-1 bg-red-900 text-red-300 rounded-full text-sm">
            未解決: {unresolvedCount}件
          </span>
        )}
      </div>

      <div className="space-y-3">
        {alerts?.map((alert: any) => {
          const account = alert.accounts;
          const persona = Array.isArray(account?.account_personas)
            ? account.account_personas[0]
            : account?.account_personas;

          return (
            <div
              key={alert.id}
              className={`border rounded-lg p-4 ${
                alert.resolved
                  ? "bg-gray-900 border-gray-800 opacity-60"
                  : alert.severity === "critical"
                  ? "bg-red-950 border-red-800"
                  : alert.severity === "warning"
                  ? "bg-yellow-950 border-yellow-800"
                  : "bg-blue-950 border-blue-800"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-sm font-medium">{alert.alert_type}</span>
                    {persona && (
                      <span className="text-xs text-gray-400">
                        / {persona.display_name || account?.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-1">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(alert.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                  </p>
                </div>
                {!alert.resolved && (
                  <form action={`/api/alerts/${alert.id}/resolve`} method="POST">
                    <button
                      type="submit"
                      className="text-xs px-3 py-1 border border-gray-600 rounded hover:bg-gray-700"
                    >
                      解決済み
                    </button>
                  </form>
                )}
                {alert.resolved && (
                  <span className="text-xs text-green-400">解決済</span>
                )}
              </div>
            </div>
          );
        })}

        {(!alerts || alerts.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            アラートはありません
          </div>
        )}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-800 text-red-200",
    warning: "bg-yellow-800 text-yellow-200",
    info: "bg-blue-800 text-blue-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${styles[severity] || styles.info}`}>
      {severity}
    </span>
  );
}
