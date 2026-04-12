import { createServiceClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createServiceClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*, account_personas(*)")
    .order("created_at");

  const today = new Date().toISOString().split("T")[0];

  // Get today's post counts per account
  const { data: todayPosts } = await supabase
    .from("posts")
    .select("account_id, status")
    .gte("scheduled_at", `${today}T00:00:00`)
    .lt("scheduled_at", `${today}T23:59:59`);

  // Get today's pipeline status
  const { data: pipelineRuns } = await supabase
    .from("pipeline_runs")
    .select("account_id, phase, status")
    .eq("date", today);

  // Get unresolved alerts
  const { data: alerts } = await supabase
    .from("system_alerts")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(5);

  const postsByAccount = new Map<string, { published: number; total: number }>();
  todayPosts?.forEach((p) => {
    const entry = postsByAccount.get(p.account_id) || { published: 0, total: 0 };
    entry.total++;
    if (p.status === "published") entry.published++;
    postsByAccount.set(p.account_id, entry);
  });

  const pipelineByAccount = new Map<string, string>();
  pipelineRuns?.forEach((r) => {
    const current = pipelineByAccount.get(r.account_id);
    if (r.status === "failed") {
      pipelineByAccount.set(r.account_id, "error");
    } else if (r.status === "processing" && current !== "error") {
      pipelineByAccount.set(r.account_id, "running");
    } else if (!current) {
      pipelineByAccount.set(r.account_id, r.status === "completed" ? "done" : "waiting");
    }
  });

  const totalPublished = Array.from(postsByAccount.values()).reduce((s, v) => s + v.published, 0);
  const totalPosts = Array.from(postsByAccount.values()).reduce((s, v) => s + v.total, 0);
  const errorCount = alerts?.length ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-gray-400 text-sm">{today}</p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="今日の投稿" value={`${totalPublished}/${totalPosts}`} />
        <SummaryCard
          label="アクティブアカウント"
          value={`${accounts?.filter((a) => a.status === "active").length ?? 0}`}
        />
        <SummaryCard
          label="未解決アラート"
          value={`${errorCount}`}
          variant={errorCount > 0 ? "warning" : "default"}
        />
      </div>

      {/* Account table */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800">
              <th className="text-left p-3">アカウント</th>
              <th className="text-left p-3">ジャンル</th>
              <th className="text-center p-3">状態</th>
              <th className="text-center p-3">今日の投稿</th>
              <th className="text-center p-3">パイプライン</th>
            </tr>
          </thead>
          <tbody>
            {accounts?.map((account) => {
              const posts = postsByAccount.get(account.id);
              const pipeline = pipelineByAccount.get(account.id);
              const persona = Array.isArray(account.account_personas)
                ? account.account_personas[0]
                : account.account_personas;

              return (
                <tr key={account.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-3">
                    <a href={`/accounts/${account.id}`} className="text-blue-400 hover:underline font-medium">
                      {persona?.display_name || account.name}
                    </a>
                  </td>
                  <td className="p-3 text-gray-400">{persona?.genre || "-"}</td>
                  <td className="p-3 text-center">
                    <StatusBadge status={account.status} />
                  </td>
                  <td className="p-3 text-center">
                    {posts ? `${posts.published}/${posts.total}` : "-"}
                  </td>
                  <td className="p-3 text-center">
                    <PipelineBadge status={pipeline} />
                  </td>
                </tr>
              );
            })}
            {(!accounts || accounts.length === 0) && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  アカウントがまだありません。
                  <a href="/accounts/new" className="text-blue-400 hover:underline ml-1">
                    追加する
                  </a>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">未解決アラート</h2>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border text-sm ${
                alert.severity === "critical"
                  ? "bg-red-950 border-red-800 text-red-200"
                  : alert.severity === "warning"
                  ? "bg-yellow-950 border-yellow-800 text-yellow-200"
                  : "bg-blue-950 border-blue-800 text-blue-200"
              }`}
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "warning";
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${variant === "warning" ? "text-yellow-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-900 text-green-300",
    testing: "bg-yellow-900 text-yellow-300",
    setup: "bg-gray-700 text-gray-300",
    paused: "bg-red-900 text-red-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${styles[status] || styles.setup}`}>
      {status}
    </span>
  );
}

function PipelineBadge({ status }: { status: string | undefined }) {
  if (!status) return <span className="text-gray-500 text-xs">-</span>;
  const styles: Record<string, string> = {
    done: "text-green-400",
    running: "text-blue-400",
    waiting: "text-gray-400",
    error: "text-red-400",
  };
  const labels: Record<string, string> = {
    done: "完了",
    running: "実行中",
    waiting: "待機",
    error: "エラー",
  };
  return <span className={`text-xs ${styles[status]}`}>{labels[status]}</span>;
}
