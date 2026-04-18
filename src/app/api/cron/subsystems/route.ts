import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * Cron endpoint: Trigger publish + replies + analytics subsystems
 * Called every 15 minutes.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get all active accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("status", "active");

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ message: "No active accounts" });
  }

  let tasksCreated = 0;

  for (const account of accounts) {
    // Enqueue publish task
    await supabase.from("task_queue").insert({
      account_id: account.id,
      task_type: "publish",
      priority: 1, // Highest - time sensitive
      payload: {},
      model: "sonnet", // Not used for publish, but required
    });
    tasksCreated++;

    // Enqueue comment_detect task (inbound: fetch comments from Threads API)
    await supabase.from("task_queue").insert({
      account_id: account.id,
      task_type: "comment_detect",
      priority: 2,
      payload: {},
      model: "sonnet", // Not used, but column required
    });
    tasksCreated++;

    // Enqueue reply task (AI generate + optional auto-send)
    await supabase.from("task_queue").insert({
      account_id: account.id,
      task_type: "reply",
      priority: 3,
      payload: {},
      model: "sonnet",
    });
    tasksCreated++;

    // Enqueue analytics task (less frequently - check if already ran in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentAnalytics } = await supabase
      .from("task_queue")
      .select("id")
      .eq("account_id", account.id)
      .eq("task_type", "analytics")
      .gte("created_at", oneHourAgo)
      .limit(1);

    if (!recentAnalytics || recentAnalytics.length === 0) {
      await supabase.from("task_queue").insert({
        account_id: account.id,
        task_type: "analytics",
        priority: 5,
        payload: {},
        model: "sonnet",
      });
      tasksCreated++;
    }
  }

  return NextResponse.json({
    message: `Subsystem tasks created for ${accounts.length} accounts`,
    tasks_created: tasksCreated,
  });
}
