import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";
import { requireAuth } from "@/lib/auth/session";

// GET /api/accounts - List all accounts
export async function GET() {
  await requireAuth();
  const supabase = createServiceClient();

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select(`
      *,
      account_personas(*),
      account_tokens(status, token_expires_at)
    `)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(accounts);
}

// POST /api/accounts - Create new account
export async function POST(req: NextRequest) {
  await requireAuth();
  const supabase = createServiceClient();
  const body = await req.json();

  const { name, slug, persona } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug required" }, { status: 400 });
  }

  // Create account
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert({ name, slug })
    .select()
    .single();

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }

  // Create persona if provided
  if (persona) {
    const { error: personaError } = await supabase
      .from("account_personas")
      .insert({
        account_id: account.id,
        display_name: persona.display_name || name,
        genre: persona.genre || "未設定",
        niche: persona.niche,
        target_audience: persona.target_audience,
        value_proposition: persona.value_proposition,
        tone_style: persona.tone_style || "カジュアル",
        age_range: persona.age_range,
        gender_feel: persona.gender_feel,
        background: persona.background,
        prohibited_words: persona.prohibited_words || [],
        reply_rules: persona.reply_rules || {},
        prompt_files: persona.prompt_files || {},
      });

    if (personaError) {
      console.error("Persona creation failed:", personaError);
    }
  }

  return NextResponse.json(account, { status: 201 });
}
