import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";
import { requireAuth } from "@/lib/auth/session";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("system_alerts")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Redirect back to alerts page
  return NextResponse.redirect(new URL("/alerts", _req.url));
}
