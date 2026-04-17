/**
 * Task Executor - タスクタイプに応じて適切なハンドラーに振り分ける
 */

import { runResearch } from "./tasks/research";
import { runIntelligence } from "./tasks/intelligence";
import { runCommunity } from "./tasks/community";
import { runMeeting } from "./tasks/meeting";
import { runGenerate } from "./tasks/generate";
import { runReply } from "./tasks/reply";
import { runPublish } from "./tasks/publish";
import { runAnalytics } from "./tasks/analytics";
import { runConceptResearch } from "./tasks/concept-research";
import { runConceptAnalysis } from "./tasks/concept-analysis";
import { runConceptProposal } from "./tasks/concept-proposal";

export interface TaskData {
  id: string;
  account_id: string;
  task_type: string;
  priority: number;
  status: string;
  payload: Record<string, any>;
  model: "opus" | "sonnet";
  retry_count: number;
  max_retries: number;
}

export async function executeTask(task: TaskData): Promise<Record<string, any>> {
  switch (task.task_type) {
    // Pipeline phases
    case "pipeline_research":
      return runResearch(task);
    case "pipeline_intelligence":
      return runIntelligence(task);
    case "pipeline_community":
      return runCommunity(task);
    case "pipeline_meeting":
      return runMeeting(task);
    case "pipeline_generate":
      return runGenerate(task);

    // Sub-systems
    case "publish":
      return runPublish(task);
    case "reply":
      return runReply(task);
    case "analytics":
      return runAnalytics(task);

    // Concept Designer (3-phase subsystem for per-account concept design)
    case "concept_research":
      return runConceptResearch(task);
    case "concept_analysis":
      return runConceptAnalysis(task);
    case "concept_proposal":
      return runConceptProposal(task);

    default:
      throw new Error(`Unknown task type: ${task.task_type}`);
  }
}
