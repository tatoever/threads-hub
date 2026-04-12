/**
 * Queue Worker - threads-hub のローカルワーカー心臓部
 *
 * task_queue テーブルをポーリングし、pending タスクを取得して逐次実行する。
 * PM2 で2-3プロセス起動し、各プロセスが独立にキューから取得。
 *
 * タスク取得は SELECT FOR UPDATE SKIP LOCKED で排他制御。
 */

import { supabase } from "./utils/supabase";
import { notifyDiscord } from "./utils/notify";
import { executeTask } from "./task-executor";

const POLL_INTERVAL_MS = 5_000; // 5秒ごとにポーリング
const WORKER_ID = `worker-${process.pid}`;
let isShuttingDown = false;

async function pollAndProcess(): Promise<void> {
  if (isShuttingDown) return;

  try {
    // Claim a pending task using RPC (atomic lock)
    const { data: task, error } = await supabase.rpc("claim_next_task", {
      p_worker_id: WORKER_ID,
    });

    if (error) {
      // RPC not yet created -> fallback to simple query
      if (error.message.includes("claim_next_task")) {
        await pollFallback();
        return;
      }
      console.error(`[${WORKER_ID}] claim error:`, error.message);
      return;
    }

    if (!task || (Array.isArray(task) && task.length === 0)) {
      // No tasks available
      return;
    }

    const taskData = Array.isArray(task) ? task[0] : task;
    console.log(`[${WORKER_ID}] Processing task ${taskData.id} (${taskData.task_type}) for account ${taskData.account_id}`);

    const startTime = Date.now();

    try {
      const result = await executeTask(taskData);

      // Mark as completed
      await supabase
        .from("task_queue")
        .update({
          status: "completed",
          result,
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskData.id);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[${WORKER_ID}] Task ${taskData.id} completed in ${elapsed}s`);
    } catch (taskError: any) {
      const retryCount = (taskData.retry_count || 0) + 1;
      const maxRetries = taskData.max_retries || 3;

      if (retryCount >= maxRetries) {
        // Max retries reached - mark as failed
        await supabase
          .from("task_queue")
          .update({
            status: "failed",
            error_message: taskError.message,
            retry_count: retryCount,
          })
          .eq("id", taskData.id);

        console.error(`[${WORKER_ID}] Task ${taskData.id} FAILED (max retries): ${taskError.message}`);

        // Alert
        await supabase.from("system_alerts").insert({
          account_id: taskData.account_id,
          alert_type: "task_failed",
          severity: "warning",
          message: `Task ${taskData.task_type} failed after ${maxRetries} retries: ${taskError.message}`,
        });

        await notifyDiscord(
          `Task ${taskData.task_type} (account: ${taskData.account_id}) failed: ${taskError.message}`,
          "warning"
        );
      } else {
        // Retry - put back to pending
        await supabase
          .from("task_queue")
          .update({
            status: "pending",
            error_message: taskError.message,
            retry_count: retryCount,
            started_at: null,
          })
          .eq("id", taskData.id);

        console.warn(`[${WORKER_ID}] Task ${taskData.id} retry ${retryCount}/${maxRetries}: ${taskError.message}`);
      }
    }
  } catch (err: any) {
    console.error(`[${WORKER_ID}] Poll error:`, err.message);
  }
}

/**
 * Fallback polling when RPC is not available.
 * Uses simple SELECT + UPDATE with optimistic locking.
 */
async function pollFallback(): Promise<void> {
  // Get oldest pending task
  const { data: tasks, error: selectError } = await supabase
    .from("task_queue")
    .select("*")
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);

  if (selectError || !tasks || tasks.length === 0) return;

  const task = tasks[0];

  // Try to claim it (optimistic lock)
  const { data: claimed, error: updateError } = await supabase
    .from("task_queue")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
    })
    .eq("id", task.id)
    .eq("status", "pending") // Only if still pending
    .select()
    .single();

  if (updateError || !claimed) {
    // Another worker claimed it
    return;
  }

  // Process it
  console.log(`[${WORKER_ID}] Processing task ${claimed.id} (${claimed.task_type})`);

  const startTime = Date.now();

  try {
    const result = await executeTask(claimed);

    await supabase
      .from("task_queue")
      .update({
        status: "completed",
        result,
        completed_at: new Date().toISOString(),
      })
      .eq("id", claimed.id);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${WORKER_ID}] Task ${claimed.id} completed in ${elapsed}s`);
  } catch (taskError: any) {
    const retryCount = (claimed.retry_count || 0) + 1;
    const maxRetries = claimed.max_retries || 3;

    if (retryCount >= maxRetries) {
      await supabase
        .from("task_queue")
        .update({
          status: "failed",
          error_message: taskError.message,
          retry_count: retryCount,
        })
        .eq("id", claimed.id);

      await notifyDiscord(
        `Task ${claimed.task_type} failed: ${taskError.message}`,
        "warning"
      );
    } else {
      await supabase
        .from("task_queue")
        .update({
          status: "pending",
          error_message: taskError.message,
          retry_count: retryCount,
          started_at: null,
        })
        .eq("id", claimed.id);
    }
  }
}

// Main loop
async function main() {
  console.log(`[${WORKER_ID}] Starting queue worker...`);
  await notifyDiscord(`Worker ${WORKER_ID} started`, "info");

  // Healthcheck: reset any stuck "processing" tasks from crashed workers
  const { data: stuck } = await supabase
    .from("task_queue")
    .update({ status: "pending", started_at: null })
    .eq("status", "processing")
    .lt("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Stuck for > 10min
    .select("id");

  if (stuck && stuck.length > 0) {
    console.log(`[${WORKER_ID}] Reset ${stuck.length} stuck tasks`);
  }

  // Poll loop
  while (!isShuttingDown) {
    await pollAndProcess();
    await sleep(POLL_INTERVAL_MS);
  }

  console.log(`[${WORKER_ID}] Worker shutting down gracefully`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Graceful shutdown
process.on("SIGTERM", () => {
  isShuttingDown = true;
});
process.on("SIGINT", () => {
  isShuttingDown = true;
});

main().catch((err) => {
  console.error(`[${WORKER_ID}] Fatal error:`, err);
  process.exit(1);
});
