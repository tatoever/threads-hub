import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";
import { requireAuth } from "@/lib/auth/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("articles")
    .select("id, slug, title, subtitle, status, published_at, updated_at, cover_image_url, word_count, reading_time_sec")
    .eq("account_id", id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
