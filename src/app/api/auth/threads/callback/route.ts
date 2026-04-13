import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";
import { exchangeForLongLivedToken } from "@/lib/threads/client";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const accountId = req.nextUrl.searchParams.get("state");

  if (!code || !accountId) {
    return NextResponse.redirect(new URL("/settings?error=missing_params", req.url));
  }

  try {
    const supabase = createServiceClient();

    // Load per-account App credentials
    const { data: account } = await supabase
      .from("accounts")
      .select("threads_app_id, threads_app_secret")
      .eq("id", accountId)
      .single();

    const appId = account?.threads_app_id || process.env.THREADS_APP_ID;
    const appSecret = account?.threads_app_secret || process.env.THREADS_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.redirect(new URL(`/accounts/${accountId}?error=no_app_credentials`, req.url));
    }

    // Step 1: Exchange code for short-lived token
    const tokenRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: process.env.NEXT_PUBLIC_THREADS_REDIRECT_URI!,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      return NextResponse.redirect(new URL(`/accounts/${accountId}?error=token_exchange`, req.url));
    }

    const { access_token: shortToken, user_id: threadsUserId } = await tokenRes.json();

    // Step 2: Exchange for long-lived token
    const longLived = await exchangeForLongLivedToken(shortToken);

    // Step 3: Save to DB
    const expiresAt = new Date(Date.now() + longLived.expires_in * 1000).toISOString();

    await supabase
      .from("accounts")
      .update({ threads_user_id: threadsUserId })
      .eq("id", accountId);

    await supabase
      .from("account_tokens")
      .upsert({
        account_id: accountId,
        access_token: longLived.access_token,
        token_expires_at: expiresAt,
        last_refreshed_at: new Date().toISOString(),
        status: "active",
      });

    return NextResponse.redirect(new URL(`/accounts/${accountId}?oauth=success`, req.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL(`/accounts/${accountId}?error=oauth_failed`, req.url));
  }
}
