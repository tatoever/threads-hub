import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

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
  const { error } = await sb
    .from("tracker_exclusions")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("device_id", device_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
