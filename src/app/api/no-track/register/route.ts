import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * 除外デバイスを登録。device_id が既にあれば is_active を true に戻して label 等を更新。
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const device_id = typeof body.device_id === "string" ? body.device_id.slice(0, 100) : null;
  if (!device_id) return NextResponse.json({ error: "device_id required" }, { status: 400 });

  const payload = {
    device_id,
    label: typeof body.label === "string" ? body.label.slice(0, 80) : null,
    user_agent: typeof body.user_agent === "string" ? body.user_agent.slice(0, 500) : null,
    platform: typeof body.platform === "string" ? body.platform.slice(0, 100) : null,
    timezone: typeof body.timezone === "string" ? body.timezone.slice(0, 80) : null,
    language: typeof body.language === "string" ? body.language.slice(0, 20) : null,
    screen_size: typeof body.screen_size === "string" ? body.screen_size.slice(0, 30) : null,
    is_active: true,
    last_seen_at: new Date().toISOString(),
    revoked_at: null,
  };

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("tracker_exclusions")
    .upsert(payload, { onConflict: "device_id" })
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, exclusion: data });
}
