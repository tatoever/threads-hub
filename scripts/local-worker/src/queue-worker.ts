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
import { insertAlert } from "./utils/alert";
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

        // Alert 振り分け: meeting の失敗は meeting_failed、それ以外は task_failed
        const isMeeting = taskData.task_type === "pipeline_meeting" || taskData.task_type === "meeting";
        await insertAlert({
          account_id: taskData.account_id,
          alert_type: isMeeting ? "meeting_failed" : "task_failed",
          severity: "warning",
          message: isMeeting
            ? `朝のmeeting失敗: ${maxRetries}回リトライ後も失敗。当日のdaily_content_planが未生成。${taskError.message}`
            : `Task ${taskData.task_type} failed after ${maxRetries} retries: ${taskError.message}`,
        });
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

/**
 * self-enqueue ループ: 5分ごと、全 active アカに publish/comment_detect/analytics
 * タスクを自律的に積む。GitHub Actions cron の遅延に依存しないためのフォールバック。
 * 既に pending/processing のタスクがあればスキップ（重複防止）。
 * Worker 1台だけが積めば全 Worker が拾える (race にならない)
 */
const SELF_ENQUEUE_INTERVAL_MS = 5 * 60 * 1000; // 5分
const SELF_ENQUEUE_TASKS = ["publish", "comment_detect", "analytics"] as const;
let isPrimaryEnqueuer = false; // 最初に起動した Worker だけが積む

async function selfEnqueueTick(): Promise<void> {
  if (!isPrimaryEnqueuer) return;
  try {
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id")
      .eq("status", "active");
    if (!accounts || accounts.length === 0) return;

    let enqueued = 0;
    for (const acc of accounts) {
      for (const taskType of SELF_ENQUEUE_TASKS) {
        // 既に pending / processing のタスクがあればスキップ
        const { data: existing } = await supabase
          .from("task_queue")
          .select("id")
          .eq("account_id", acc.id)
          .eq("task_type", taskType)
          .in("status", ["pending", "processing"])
          .limit(1);
        if (existing && existing.length > 0) continue;

        await supabase.from("task_queue").insert({
          account_id: acc.id,
          task_type: taskType,
          priority: 5,
          payload: { trigger: "self_enqueue" },
          model: "sonnet",
        });
        enqueued++;
      }
    }
    if (enqueued > 0) {
      console.log(`[${WORKER_ID}] self-enqueue: ${enqueued} tasks across ${accounts.length} accounts`);
    }
  } catch (err: any) {
    console.error(`[${WORKER_ID}] self-enqueue error:`, err?.message);
  }
}

/**
 * 最初に起動した Worker だけが primary になるロック。
 * worker_state テーブルを使わず、task_queue に mutex 的レコードを置く方式はコスト高いので
 * 単に setInterval の冪等性（既存 pending があればスキップ）で充分。
 * ここでは常に isPrimaryEnqueuer=true にして、全 Worker が 5分ごと呼ぶが
 * insert は冪等ガードで重複しない。
 */

/**
 * 日次 cron self-enqueue (Vercel Hobby plan の flexible window 障害対策)
 *
 * - JST 5:30 以降で当日 pipeline_runs が未生成 → pipeline タスク 40件 (10アカ × 4フェーズ) を積む
 * - JST 7:30 以降で当日 daily_health_summaries が未生成 → /api/cron/morning-health を呼び出す
 *
 * 冪等: 既に pipeline_runs / daily_health_summaries が存在すれば何もしない
 */
async function selfEnqueueDailyIfNeeded(): Promise<void> {
  if (!isPrimaryEnqueuer) return;
  try {
    const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
    const jstHour = jstNow.getUTCHours();
    const todayJst = jstNow.toISOString().slice(0, 10);

    // === 1. pipeline (research/intelligence/community/meeting) ===
    if (jstHour >= 5 && jstHour <= 11) {
      const { count } = await supabase
        .from("pipeline_runs")
        .select("*", { count: "exact", head: true })
        .eq("date", todayJst);
      if ((count ?? 0) === 0) {
        // 当日 pipeline 未実行 → 全 active アカに 4フェーズタスクを積む
        const { data: accounts } = await supabase
          .from("accounts")
          .select("id")
          .eq("status", "active");
        if (accounts && accounts.length > 0) {
          const phases = [
            { task: "pipeline_research", model: "sonnet", priority: 1 },
            { task: "pipeline_intelligence", model: "sonnet", priority: 2 },
            { task: "pipeline_community", model: "sonnet", priority: 3 },
            { task: "pipeline_meeting", model: "opus", priority: 4 },
          ];
          let added = 0;
          for (const acc of accounts) {
            for (const p of phases) {
              await supabase.from("task_queue").insert({
                account_id: acc.id,
                task_type: p.task,
                priority: p.priority,
                payload: { date: todayJst, trigger: "self_enqueue_daily_pipeline" },
                model: p.model,
              });
              added++;
            }
            // pipeline_runs に pending レコード作成 (Vercel cron route と同じ動作)
            for (const phase of ["research", "intelligence", "community", "meeting"]) {
              await supabase.from("pipeline_runs").upsert(
                { account_id: acc.id, date: todayJst, phase, status: "pending" },
                { onConflict: "account_id,date,phase" }
              );
            }
          }
          console.log(
            `[${WORKER_ID}] self-enqueue DAILY pipeline: ${added} tasks across ${accounts.length} accounts (Vercel cron 不発火 検出)`
          );
        }
      }
    }

    // === 2. morning-health ===
    if (jstHour >= 7) {
      const { data: existing } = await supabase
        .from("daily_health_summaries")
        .select("date")
        .eq("date", todayJst)
        .maybeSingle();
      if (!existing) {
        // 未実行 → 内部で morning-health の API を呼ぶ
        const baseUrl = process.env.PUBLIC_BASE_URL || "https://urasan-threads-auto-hub.vercel.app";
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
          try {
            const res = await fetch(`${baseUrl}/api/cron/morning-health`, {
              method: "GET",
              headers: { Authorization: `Bearer ${cronSecret}` },
            });
            if (res.ok) {
              console.log(`[${WORKER_ID}] self-enqueue DAILY morning-health: triggered (Vercel cron 不発火 補完)`);
            } else {
              console.warn(`[${WORKER_ID}] morning-health trigger failed: ${res.status}`);
            }
          } catch (err: any) {
            console.warn(`[${WORKER_ID}] morning-health fetch error:`, err?.message);
          }
        }
      }
    }
  } catch (err: any) {
    console.error(`[${WORKER_ID}] self-enqueue DAILY error:`, err?.message);
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

  // self-enqueue を有効化（冪等性で複数ワーカーでも大丈夫）
  isPrimaryEnqueuer = true;
  await selfEnqueueTick(); // 起動直後に1回
  await selfEnqueueDailyIfNeeded(); // 起動直後に1回
  setInterval(selfEnqueueTick, SELF_ENQUEUE_INTERVAL_MS);
  setInterval(selfEnqueueDailyIfNeeded, SELF_ENQUEUE_INTERVAL_MS);
  console.log(`[${WORKER_ID}] self-enqueue interval: ${SELF_ENQUEUE_INTERVAL_MS / 1000}s (subsystems + daily)`);

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
