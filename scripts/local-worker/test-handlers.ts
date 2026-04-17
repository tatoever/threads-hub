import { supabase } from "./src/utils/supabase";

const RYU_ID = "999d5537-e40c-4328-80c8-5aa55836b7a2";
const today = new Date().toISOString().split("T")[0];

async function main() {
  // Reset research pipeline_run to pending
  await supabase.from("pipeline_runs")
    .update({ status: "pending", output_data: null, completed_at: null, model_used: null })
    .eq("account_id", RYU_ID).eq("date", today).eq("phase", "research");

  // Simulate what research handler does at the end
  const { data, error } = await supabase.from("pipeline_runs")
    .update({
      status: "completed",
      output_data: { test: "from_handler_simulation" },
      model_used: "sonnet",
      completed_at: new Date().toISOString(),
    })
    .eq("account_id", RYU_ID)
    .eq("date", today)
    .eq("phase", "research")
    .select();

  console.log("Update result:", data?.length, "rows");
  console.log("Error:", error?.message || "none");
  
  // Verify
  const { data: check } = await supabase.from("pipeline_runs")
    .select("status,output_data")
    .eq("account_id", RYU_ID).eq("date", today).eq("phase", "research").single();
  console.log("Verification:", check?.status, "has_output:", !!check?.output_data);
}

main();
