import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";
import { requireAuth } from "@/lib/auth/session";
import { fetchProfile } from "@/lib/threads/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .select("id, threads_user_id, account_tokens(access_token, status)")
    .eq("id", id)
    .maybeSingle();

  if (accErr || !account) {
    return NextResponse.json(
      { error: accErr?.message ?? "account not found" },
      { status: 404 },
    );
  }

  const token = Array.isArray(account.account_tokens)
    ? account.account_tokens[0]
    : account.account_tokens;

  if (!token?.access_token || token.status !== "active") {
    return NextResponse.json(
      { error: "Threads APIに接続されていません" },
      { status: 400 },
    );
  }

  if (!account.threads_user_id) {
    return NextResponse.json(
      { error: "threads_user_id 未設定" },
      { status: 400 },
    );
  }

  try {
    const profile = await fetchProfile({
      accessToken: token.access_token,
      userId: account.threads_user_id,
    });

    const { data: updated, error: updErr } = await supabase
      .from("accounts")
      .update({
        profile_picture_url: profile.threads_profile_picture_url ?? null,
        profile_bio: profile.threads_biography ?? null,
        threads_username: profile.username ?? null,
        profile_synced_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, profile_picture_url, profile_bio, threads_username, profile_synced_at")
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Threads API error" },
      { status: 502 },
    );
  }
}
