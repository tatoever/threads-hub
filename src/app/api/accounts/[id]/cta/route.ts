import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";
import { requireAuth } from "@/lib/auth/session";

// GET /api/accounts/:id/cta
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("cta_destinations")
    .select("*")
    .eq("account_id", id)
    .order("priority", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/accounts/:id/cta
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;
  const supabase = createServiceClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from("cta_destinations")
    .insert({
      ...body,
      account_id: id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
