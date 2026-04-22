import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * alert_configs.enabled をトグル切替。
 * - Body: { enabled: boolean } で指定値に設定
 * - Body なし: 現在値の反転
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  if (!type) return NextResponse.json({ error: "alert_type required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: current } = await supabase
    .from("alert_configs")
    .select("enabled")
    .eq("alert_type", type)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: `alert_type not found: ${type}` }, { status: 404 });
  }

  // body があれば enabled 値を使い、なければトグル
  let enabled = !current.enabled;
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("json")) {
    try {
      const body = await req.json();
      if (typeof body.enabled === "boolean") enabled = body.enabled;
    } catch {}
  } else if (contentType.includes("form")) {
    try {
      const form = await req.formData();
      const v = form.get("enabled");
      if (v === "true") enabled = true;
      else if (v === "false") enabled = false;
      // それ以外はトグル維持
    } catch {}
  }

  const { error } = await supabase
    .from("alert_configs")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("alert_type", type);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (contentType.includes("form")) {
    return NextResponse.redirect(new URL("/alerts", req.url), 303);
  }
  return NextResponse.json({ ok: true, alert_type: type, enabled });
}
