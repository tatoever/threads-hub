import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * Cron endpoint: Trigger morning pipeline for all active accounts
 * Called by Vercel Cron at 05:00 JST daily
 *
 * Enqueues Phase 1-4 tasks for each active account with time offsets.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Get all active accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, schedule_offset_minutes, default_model")
    .eq("status", "active")
    .order("schedule_offset_minutes", { ascending: true });

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ message: "No active accounts" });
  }

  const phases = ["pipeline_research", "pipeline_intelligence", "pipeline_community", "pipeline_meeting"];
  const phaseModels: Record<string, string> = {
    pipeline_research: "sonnet",
    pipeline_intelligence: "sonnet",
    pipeline_community: "sonnet",
    pipeline_meeting: "opus",
  };

  let tasksCreated = 0;

  for (const account of accounts) {
    // Check if pipeline already ran today
    const { data: existing } = await supabase
      .from("pipeline_runs")
      .select("id")
      .eq("account_id", account.id)
      .eq("date", today)
      .eq("phase", "meeting")
      .eq("status", "completed")
      .limit(1);

    if (existing && existing.length > 0) {
      continue; // Already completed today
    }

    // Enqueue Phase 1-4 tasks with priority ordering
    for (let i = 0; i < phases.length; i++) {
      const { error } = await supabase.from("task_queue").insert({
        account_id: account.id,
        task_type: phases[i],
        priority: i + 1, // 1=highest priority (research first)
        payload: { date: today },
        model: phaseModels[phases[i]] || account.default_model || "opus",
      });

      if (!error) tasksCreated++;
    }

    // Mark pipeline as started
    for (const phase of ["research", "intelligence", "community", "meeting"]) {
      await supabase.from("pipeline_runs").upsert({
        account_id: account.id,
        date: today,
        phase,
        status: "pending",
      });
    }
  }

  return NextResponse.json({
    message: `Pipeline triggered for ${accounts.length} accounts`,
    tasks_created: tasksCreated,
  });
}
