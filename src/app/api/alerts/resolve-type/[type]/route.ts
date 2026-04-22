import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * 特定の alert_type の未解決分を一括 resolved にする。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  if (!type) {
    return NextResponse.json({ error: "alert_type required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("system_alerts")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("resolved", false)
    .eq("alert_type", type)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("form")) {
    return NextResponse.redirect(new URL("/alerts", req.url), 303);
  }
  return NextResponse.json({ ok: true, alert_type: type, resolved: data?.length ?? 0 });
}
