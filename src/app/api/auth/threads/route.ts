import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/client";

// Initiate Threads OAuth flow for a specific account
// Uses per-account App credentials for BAN isolation
export async function GET(req: NextRequest) {
  await requireAuth();

  const accountId = req.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Load per-account App credentials
  const { data: account } = await supabase
    .from("accounts")
    .select("threads_app_id, threads_app_secret")
    .eq("id", accountId)
    .single();

  const appId = account?.threads_app_id || process.env.THREADS_APP_ID;

  if (!appId) {
    return NextResponse.json(
      { error: "このアカウントにMeta App IDが設定されていません。アカウント設定からApp IDを登録してください。" },
      { status: 400 }
    );
  }

  const redirectUri = process.env.NEXT_PUBLIC_THREADS_REDIRECT_URI;
  const scope = "threads_basic,threads_content_publish,threads_manage_replies,threads_manage_insights,threads_read_replies";

  const authUrl = `https://threads.net/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri!)}&scope=${scope}&response_type=code&state=${accountId}`;

  return NextResponse.redirect(authUrl);
}
