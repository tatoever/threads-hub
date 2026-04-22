import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * 全未解決アラートを一括で resolved にする。
 */
export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("system_alerts")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("resolved", false)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // UIからフォーム送信の場合は /alerts にリダイレクト
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("form")) {
    return NextResponse.redirect(new URL("/alerts", req.url), 303);
  }
  return NextResponse.json({ ok: true, resolved: data?.length ?? 0 });
}
