import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";
import { requireAuth } from "@/lib/auth/session";

const ALLOWED_FIELDS = new Set([
  "name",
  "cta_type",
  "url",
  "description",
  "content_body",
  "tags",
  "is_active",
  "priority",
  "cta_templates",
  "placement_rules",
  "expires_at",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ctaId: string }> },
) {
  await requireAuth();
  const { id, ctaId } = await params;
  const body = await req.json();

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) payload[k] = v;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cta_destinations")
    .update(payload)
    .eq("id", ctaId)
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
  { params }: { params: Promise<{ id: string; ctaId: string }> },
) {
  await requireAuth();
  const { id, ctaId } = await params;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("cta_destinations")
    .delete()
    .eq("id", ctaId)
    .eq("account_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
