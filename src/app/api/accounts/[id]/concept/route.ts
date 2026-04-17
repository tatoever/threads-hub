import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * Concept Designer API for a specific account
 *
 * GET  /api/accounts/:id/concept
 *   → Returns research / analysis / proposals / status
 *
 * POST /api/accounts/:id/concept
 *   body: { action: 'approve', proposal_id: string }
 *   body: { action: 'reject', feedback: string }
 *   body: { action: 'retry' }
 *
 * See: _AIエージェント/concept-designer-spec.md §2
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: accountId } = await params;
  const supabase = createServiceClient();

  const [account, research, analysis, proposals] = await Promise.all([
    supabase.from("accounts").select("id,name,slug,concept_status,concept_definition").eq("id", accountId).single(),
    supabase.from("concept_research").select("*").eq("account_id", accountId).order("created_at", { ascending: false }),
    supabase.from("concept_analysis").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("concept_proposals").select("*").eq("account_id", accountId).order("proposal_rank", { ascending: true }),
  ]);

  if (account.error) return NextResponse.json({ error: account.error.message }, { status: 404 });

  return NextResponse.json({
    account: account.data,
    research: research.data || [],
    analysis: analysis.data,
    proposals: proposals.data || [],
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: accountId } = await params;
  const body = await req.json();
  const { action } = body;

  const supabase = createServiceClient();

  if (action === "approve") {
    const { proposal_id } = body;
    if (!proposal_id) {
      return NextResponse.json({ error: "proposal_id required" }, { status: 400 });
    }

    // 1. Get the proposal
    const { data: proposal, error: pErr } = await supabase
      .from("concept_proposals")
      .select("*")
      .eq("id", proposal_id)
      .single();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 404 });

    // 2. Approve the chosen proposal, reject others
    await supabase.from("concept_proposals").update({ status: "approved" }).eq("id", proposal_id);
    await supabase.from("concept_proposals")
      .update({ status: "rejected" })
      .eq("account_id", accountId)
      .neq("id", proposal_id)
      .eq("status", "pending");

    // 3. Update accounts table
    await supabase.from("accounts").update({
      concept_status: "locked",
      concept_definition: {
        name: proposal.concept_name,
        means: proposal.means_shift,
        position: proposal.position_shift,
        reason: proposal.establishment_reason,
        weirdness_score: proposal.weirdness_score,
        approved_at: new Date().toISOString(),
      },
    }).eq("id", accountId);

    return NextResponse.json({ message: "Concept approved and locked", proposal });
  }

  if (action === "reject") {
    const { feedback } = body;
    if (!feedback) {
      return NextResponse.json({ error: "feedback required" }, { status: 400 });
    }

    // 1. Mark all current proposals as rejected with feedback
    await supabase.from("concept_proposals")
      .update({ status: "rejected", feedback })
      .eq("account_id", accountId)
      .eq("status", "pending");

    // 2. Reset account status
    await supabase.from("accounts").update({ concept_status: "pending_research" }).eq("id", accountId);

    // 3. Trigger re-run via the cron endpoint logic (enqueue 3 tasks)
    const phases = [
      { task_type: "concept_research", priority: 1, model: "opus" },
      { task_type: "concept_analysis", priority: 2, model: "opus" },
      { task_type: "concept_proposal", priority: 3, model: "opus" },
    ];
    for (const phase of phases) {
      await supabase.from("task_queue").insert({
        account_id: accountId,
        task_type: phase.task_type,
        priority: phase.priority,
        payload: { concept_design_run: true, feedback },
        model: phase.model,
      });
    }
    await supabase.from("accounts").update({ concept_status: "researching" }).eq("id", accountId);

    return NextResponse.json({ message: "Rejected, re-running with feedback" });
  }

  if (action === "retry") {
    // Just re-enqueue without feedback
    await supabase.from("accounts").update({ concept_status: "researching" }).eq("id", accountId);
    const phases = [
      { task_type: "concept_research", priority: 1 },
      { task_type: "concept_analysis", priority: 2 },
      { task_type: "concept_proposal", priority: 3 },
    ];
    for (const phase of phases) {
      await supabase.from("task_queue").insert({
        account_id: accountId,
        task_type: phase.task_type,
        priority: phase.priority,
        payload: { concept_design_run: true },
        model: "opus",
      });
    }
    return NextResponse.json({ message: "Retry triggered" });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
