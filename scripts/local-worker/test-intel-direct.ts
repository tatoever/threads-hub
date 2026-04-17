import { runIntelligence } from "./src/tasks/intelligence";
import { supabase } from "./src/utils/supabase";

const RYU_ID = "999d5537-e40c-4328-80c8-5aa55836b7a2";
const today = new Date().toISOString().split("T")[0];

async function main() {
  // Reset
  await supabase.from("pipeline_runs")
    .update({ status: "pending", output_data: null, completed_at: null })
    .eq("account_id", RYU_ID).eq("date", today).eq("phase", "intelligence");

  console.log("Running intelligence handler...");
  const result = await runIntelligence({
    id: "test", account_id: RYU_ID, task_type: "pipeline_intelligence",
    priority: 1, status: "processing", payload: { date: today },
    model: "sonnet", retry_count: 0, max_retries: 3,
  });
  console.log("Result:", JSON.stringify(result));

  // Check pipeline_runs
  const { data } = await supabase.from("pipeline_runs")
    .select("status,output_data").eq("account_id", RYU_ID).eq("date", today).eq("phase", "intelligence").single();
  console.log("Pipeline run:", data?.status, "output?", !!data?.output_data);
}

main().catch(e => console.error("ERROR:", e.message));
