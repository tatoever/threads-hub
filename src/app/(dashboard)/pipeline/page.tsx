import { createServiceClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Get all accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, slug, status, account_personas(display_name)")
    .order("created_at");

  // Get today's pipeline runs
  const { data: pipelineRuns } = await supabase
    .from("pipeline_runs")
    .select("*")
    .eq("date", today)
    .order("account_id");

  // Get task queue status
  const { data: pendingTasks } = await supabase
    .from("task_queue")
    .select("account_id, task_type, status, created_at")
    .in("status", ["pending", "processing"])
    .order("priority", { ascending: true });

  // Group pipeline runs by account
  const pipelineByAccount = new Map<string, any[]>();
  pipelineRuns?.forEach((r: any) => {
    const existing = pipelineByAccount.get(r.account_id) || [];
    existing.push(r);
    pipelineByAccount.set(r.account_id, existing);
  });

  const phases = ["research", "intelligence", "community", "meeting", "generate"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">パイプライン状況</h1>
        <p className="text-gray-400 text-sm">{today}</p>
      </div>

      {/* Pending tasks */}
      {pendingTasks && pendingTasks.length > 0 && (
        <div className="bg-blue-950 border border-blue-800 rounded-lg p-4">
          <p className="text-blue-300 text-sm font-medium">
            処理待ちタスク: {pendingTasks.length}件
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {pendingTasks.map((t: any) => (
              <span
                key={t.created_at}
                className={`text-xs px-2 py-1 rounded ${
                  t.status === "processing"
                    ? "bg-blue-800 text-blue-200"
                    : "bg-gray-800 text-gray-300"
                }`}
              >
                {t.task_type} ({t.status})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline matrix */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800">
              <th className="text-left p-3">アカウント</th>
              {phases.map((phase) => (
                <th key={phase} className="text-center p-3 capitalize">{phase}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts?.map((account: any) => {
              const runs = pipelineByAccount.get(account.id) || [];
              const persona = Array.isArray(account.account_personas)
                ? account.account_personas[0]
                : account.account_personas;

              return (
                <tr key={account.id} className="border-b border-gray-800/50">
                  <td className="p-3">
                    <span className="font-medium">
                      {persona?.display_name || account.name}
                    </span>
                  </td>
                  {phases.map((phase) => {
                    const run = runs.find((r: any) => r.phase === phase);
                    return (
                      <td key={phase} className="p-3 text-center">
                        <PhaseStatus run={run} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PhaseStatus({ run }: { run: any }) {
  if (!run) return <span className="text-gray-600">-</span>;

  const styles: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-gray-700", text: "text-gray-300", label: "待機" },
    processing: { bg: "bg-blue-800", text: "text-blue-200", label: "実行中" },
    completed: { bg: "bg-green-900", text: "text-green-300", label: "完了" },
    failed: { bg: "bg-red-900", text: "text-red-300", label: "失敗" },
  };

  const style = styles[run.status] || styles.pending;

  return (
    <span className={`text-xs px-2 py-1 rounded ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
