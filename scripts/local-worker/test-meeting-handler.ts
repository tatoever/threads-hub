import { runMeeting } from "./src/tasks/meeting";

const RYU_ID = "999d5537-e40c-4328-80c8-5aa55836b7a2";
const today = new Date().toISOString().split("T")[0];

async function main() {
  console.log("Calling runMeeting directly...");
  console.log("Date:", today);
  
  const fakeTask = {
    id: "test-direct",
    account_id: RYU_ID,
    task_type: "pipeline_meeting",
    priority: 4,
    status: "processing",
    payload: { date: today },
    model: "opus" as const,
    retry_count: 0,
    max_retries: 3,
  };

  try {
    const result = await runMeeting(fakeTask);
    console.log("SUCCESS:", JSON.stringify(result));
  } catch (e: any) {
    console.error("FAILED:", e.message.slice(0, 500));
  }
}

main();
