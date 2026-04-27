import { createServiceClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusDot, statusToTone } from "@/components/shell/StatusDot";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { HealthSummaryCard, type HealthSummary } from "@/components/dashboard/HealthSummaryCard";

export const dynamic = "force-dynamic";

const PHASES = ["research", "intelligence", "community", "meeting", "generate"] as const;

const PHASE_LABELS: Record<(typeof PHASES)[number], string> = {
  research: "Research",
  intelligence: "Intelligence",
  community: "Community",
  meeting: "Meeting",
  generate: "Generate",
};

export default async function PipelinePage() {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, slug, status, account_personas(display_name)")
    .order("created_at");

  const { data: pipelineRuns } = await supabase
    .from("pipeline_runs")
    .select("*")
    .eq("date", today)
    .order("account_id");

  const { data: pendingTasks } = await supabase
    .from("task_queue")
    .select("account_id, task_type, status, created_at")
    .in("status", ["pending", "processing"])
    .order("priority", { ascending: true });

  const { data: healthRow } = await supabase
    .from("daily_health_summaries")
    .select("*")
    .eq("date", today)
    .maybeSingle();
  const healthSummary = (healthRow as HealthSummary | null) ?? null;

  const pipelineByAccount = new Map<string, any[]>();
  pipelineRuns?.forEach((r: any) => {
    const existing = pipelineByAccount.get(r.account_id) || [];
    existing.push(r);
    pipelineByAccount.set(r.account_id, existing);
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <PageHeader
        title="パイプライン"
        description={`${today} · フェーズごとの実行状況`}
      />

      <HealthSummaryCard summary={healthSummary} />

      {pendingTasks && pendingTasks.length > 0 && (
        <Card className="p-5 bg-info-muted/40 border-info/20">
          <p className="text-sm font-medium text-info">
            処理待ちタスク: {pendingTasks.length}件
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingTasks.map((t: any) => (
              <Badge
                key={t.created_at}
                variant={t.status === "processing" ? "info" : "secondary"}
              >
                {t.task_type} · {t.status === "processing" ? "実行中" : "待機"}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">本日のフェーズ実行状況</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Phase 1（Input）→ Phase 2（Meeting）→ Phase 3（Generate）
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">アカウント</TableHead>
              {PHASES.map((p) => (
                <TableHead key={p} className="text-center">
                  {PHASE_LABELS[p]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts?.map((account: any) => {
              const runs = pipelineByAccount.get(account.id) || [];
              const persona = Array.isArray(account.account_personas)
                ? account.account_personas[0]
                : account.account_personas;

              return (
                <TableRow key={account.id}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2">
                      <StatusDot tone={statusToTone(account.status)} />
                      <span className="font-medium">
                        {persona?.display_name || account.name}
                      </span>
                    </div>
                  </TableCell>
                  {PHASES.map((phase) => {
                    const run = runs.find((r: any) => r.phase === phase);
                    return (
                      <TableCell key={phase} className="text-center">
                        <PhaseStatus run={run} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
            {(!accounts || accounts.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={PHASES.length + 1}
                  className="text-center text-muted-foreground py-10"
                >
                  アカウントがありません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function PhaseStatus({ run }: { run: any }) {
  if (!run) return <span className="text-muted-foreground/50">—</span>;

  const map: Record<
    string,
    { variant: "success" | "info" | "secondary" | "danger"; label: string }
  > = {
    completed: { variant: "success", label: "完了" },
    processing: { variant: "info", label: "実行中" },
    pending: { variant: "secondary", label: "待機" },
    failed: { variant: "danger", label: "失敗" },
  };

  const entry = map[run.status] ?? map.pending;
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
