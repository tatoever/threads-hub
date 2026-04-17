import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * Cron endpoint: Trigger post generation for upcoming slots
 * Called every 15 minutes.
 *
 * Checks for slots that are 30-60 minutes away and enqueues generate tasks.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  // JST 基準の「今日」を使う（UTC だと pipeline と日付がずれて meeting plan が見つからない）
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const now = new Date();
  const in60min = new Date(now.getTime() + 60 * 60 * 1000);

  // Get all active accounts with completed meeting plans
  const { data: meetingPlans } = await supabase
    .from("pipeline_runs")
    .select("account_id, output_data")
    .eq("date", today)
    .eq("phase", "meeting")
    .eq("status", "completed");

  if (!meetingPlans || meetingPlans.length === 0) {
    return NextResponse.json({ message: "No meeting plans ready" });
  }

  let tasksCreated = 0;

  for (const plan of meetingPlans) {
    const contentPlan = plan.output_data as any;
    if (!contentPlan?.slots) continue;

    // Get account's model preference
    const { data: account } = await supabase
      .from("accounts")
      .select("default_model")
      .eq("id", plan.account_id)
      .single();

    for (const slot of contentPlan.slots) {
      // Parse scheduled time
      const scheduledAt = new Date(`${today}T${slot.scheduled_time}:00+09:00`);
      const diffMs = scheduledAt.getTime() - now.getTime();

      // Only generate if 30-60 minutes away
      if (diffMs < 30 * 60 * 1000 || diffMs > 60 * 60 * 1000) {
        continue;
      }

      // Check if already generated
      const { data: existingPost } = await supabase
        .from("posts")
        .select("id")
        .eq("account_id", plan.account_id)
        .eq("slot_number", slot.slot_number)
        .gte("scheduled_at", `${today}T00:00:00`)
        .limit(1);

      if (existingPost && existingPost.length > 0) {
        continue; // Already generated
      }

      // Check if task already in queue
      const { data: existingTask } = await supabase
        .from("task_queue")
        .select("id")
        .eq("account_id", plan.account_id)
        .eq("task_type", "pipeline_generate")
        .in("status", ["pending", "processing"])
        .limit(1);

      if (existingTask && existingTask.length > 0) {
        continue;
      }

      // Enqueue generate task
      const { error } = await supabase.from("task_queue").insert({
        account_id: plan.account_id,
        task_type: "pipeline_generate",
        priority: 2,
        payload: { date: today, slot_number: slot.slot_number },
        model: account?.default_model || "opus",
      });

      if (!error) tasksCreated++;
    }
  }

  return NextResponse.json({
    message: `Generate triggered`,
    tasks_created: tasksCreated,
  });
}
