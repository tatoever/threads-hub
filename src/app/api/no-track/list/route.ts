import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

export async function GET() {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("tracker_exclusions")
    .select("id, device_id, label, user_agent, platform, timezone, language, screen_size, is_active, excluded_at, last_seen_at, revoked_at")
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ exclusions: data ?? [] });
}
