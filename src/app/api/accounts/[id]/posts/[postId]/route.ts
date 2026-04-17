import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";
import { requireAuth } from "@/lib/auth/session";

const ALLOWED_FIELDS = new Set([
  "content",
  "status",
  "scheduled_at",
  "reply_1",
  "reply_2",
  "template_type",
  "category",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  await requireAuth();
  const { id, postId } = await params;
  const body = await req.json();

  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) payload[k] = v;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "no valid fields" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("posts")
    .update(payload)
    .eq("id", postId)
    .eq("account_id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  await requireAuth();
  const { id, postId } = await params;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("account_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
