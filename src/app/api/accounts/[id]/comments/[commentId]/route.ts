import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";
import { requireAuth } from "@/lib/auth/session";

const ALLOWED_FIELDS = new Set(["reply_status", "reply_text"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  await requireAuth();
  const { id, commentId } = await params;
  const body = await req.json();

  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) payload[k] = v;
  }
  if (payload.reply_status === "sent" || payload.reply_status === "skipped") {
    payload.replied = true;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "no valid fields" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("comments")
    .update(payload)
    .eq("id", commentId)
    .eq("account_id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
