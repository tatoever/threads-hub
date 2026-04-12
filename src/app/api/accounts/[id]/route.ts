import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";
import { requireAuth } from "@/lib/auth/session";

// GET /api/accounts/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("accounts")
    .select(`
      *,
      account_personas(*),
      account_tokens(status, token_expires_at),
      research_sources(*),
      cta_destinations(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH /api/accounts/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;
  const supabase = createServiceClient();
  const body = await req.json();

  const { persona, ...accountFields } = body;

  // Update account fields
  if (Object.keys(accountFields).length > 0) {
    const { error } = await supabase
      .from("accounts")
      .update({ ...accountFields, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Update persona if provided
  if (persona) {
    const { error } = await supabase
      .from("account_personas")
      .upsert({ account_id: id, ...persona, updated_at: new Date().toISOString() });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/accounts/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase.from("accounts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
