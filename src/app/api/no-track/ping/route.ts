import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * 除外デバイスの last_seen_at 更新（軽量 ping）。
 * ArticleTracker から noTrack が立ってるブラウザが呼ぶ用。
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

  const sb = createServiceClient();
  await sb
    .from("tracker_exclusions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("device_id", device_id)
    .eq("is_active", true);

  return NextResponse.json({ ok: true });
}
