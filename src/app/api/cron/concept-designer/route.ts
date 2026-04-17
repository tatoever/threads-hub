import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * Cron endpoint: Trigger Concept Designer for accounts with concept_status='pending_research'
 *
 * Enqueues 3-phase tasks:
 *   1. concept_research  (priority 1)
 *   2. concept_analysis  (priority 2, runs after research completes)
 *   3. concept_proposal  (priority 3, runs after analysis completes)
 *
 * Note: Phases B/C should ideally wait for the previous phase to complete.
 *       This initial implementation enqueues all 3 at once with priority ordering.
 *       task-executor will check upstream phase completion before running downstream.
 *
 * See: _AIエージェント/concept-designer-spec.md §1
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get accounts needing concept design
  const { data: accounts, error: accErr } = await supabase
    .from("accounts")
    .select("id, name, slug")
    .eq("concept_status", "pending_research");

  if (accErr) {
    return NextResponse.json({ error: accErr.message }, { status: 500 });
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ message: "No accounts need concept design" });
  }

  const phases = [
    { task_type: "concept_research", priority: 1, model: "opus" },
    { task_type: "concept_analysis", priority: 2, model: "opus" },
    { task_type: "concept_proposal", priority: 3, model: "opus" },
  ];

  let tasksCreated = 0;
  const updatedAccounts: string[] = [];

  for (const account of accounts) {
    // Mark status as researching
    await supabase
      .from("accounts")
      .update({ concept_status: "researching" })
      .eq("id", account.id);

    updatedAccounts.push(account.name);

    // Enqueue 3 tasks
    for (const phase of phases) {
      const { error } = await supabase.from("task_queue").insert({
        account_id: account.id,
        task_type: phase.task_type,
        priority: phase.priority,
        payload: { concept_design_run: true },
        model: phase.model,
      });

      if (!error) tasksCreated++;
    }
  }

  return NextResponse.json({
    message: `Concept Designer triggered for ${accounts.length} accounts`,
    accounts: updatedAccounts,
    tasks_created: tasksCreated,
  });
}
