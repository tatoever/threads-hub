import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

// Initiate Threads OAuth flow for a specific account
export async function GET(req: NextRequest) {
  await requireAuth();

  const accountId = req.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id required" }, { status: 400 });
  }

  const appId = process.env.THREADS_APP_ID;
  const redirectUri = process.env.NEXT_PUBLIC_THREADS_REDIRECT_URI;
  const scope = "threads_basic,threads_content_publish,threads_manage_replies,threads_manage_insights,threads_read_replies";

  const authUrl = `https://threads.net/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri!)}&scope=${scope}&response_type=code&state=${accountId}`;

  return NextResponse.redirect(authUrl);
}
