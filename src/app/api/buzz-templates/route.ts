import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";
import { requireAuth } from "@/lib/auth/session";

// GET /api/buzz-templates  ?active=true でアクティブのみ
export async function GET(req: NextRequest) {
  await requireAuth();
  const supabase = createServiceClient();
  const activeOnly = req.nextUrl.searchParams.get("active") === "true";

  let query = supabase.from("buzz_templates").select("*").order("code", { ascending: true });
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/buzz-templates
export async function POST(req: NextRequest) {
  await requireAuth();
  const supabase = createServiceClient();
  const body = await req.json();

  const required = ["code", "name", "prompt_body"];
  for (const k of required) {
    if (!body[k]) return NextResponse.json({ error: `Missing required field: ${k}` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("buzz_templates")
    .insert({
      code: body.code,
      name: body.name,
      description: body.description || null,
      prompt_body: body.prompt_body,
      requires_cta_type: body.requires_cta_type || null,
      cta_placement: body.cta_placement || null,
      length_hint: body.length_hint || null,
      example_refs: body.example_refs || null,
      avg_engagement: body.avg_engagement || null,
      is_active: body.is_active !== false,
      tags: body.tags || [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
