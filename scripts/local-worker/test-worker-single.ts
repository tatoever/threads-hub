import { supabase } from "./src/utils/supabase";
import { executeTask } from "./src/task-executor";

const RYU = "999d5537-e40c-4328-80c8-5aa55836b7a2";
const today = new Date().toISOString().split("T")[0];

async function main() {
  const { data: tasks } = await supabase.from("task_queue")
    .select("*").eq("account_id", RYU).eq("status", "pending").limit(1);
  
  if (!tasks?.length) { console.log("No pending tasks"); return; }
  const task = tasks[0];
  console.log("Claimed:", task.task_type);

  const result = await executeTask(task);
  console.log("Handler result:", JSON.stringify(result));

  const { data: run } = await supabase.from("pipeline_runs")
    .select("status,output_data").eq("account_id", RYU).eq("date", today).eq("phase", "intelligence").single();
  console.log("Pipeline run:", run?.status, "output?", !!run?.output_data);
}

main().catch(e => console.error("ERR:", e.message)).finally(() => process.exit(0));
