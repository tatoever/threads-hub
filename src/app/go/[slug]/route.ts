import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

export const runtime = "edge";

/**
 * /go/{slug} → short_links.target_url に 302 redirect
 * クリック数をカウントし、将来的な分析用ログも article_events に残す。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!/^[a-z2-9]{4,10}$/.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { data: link } = await supabase
    .from("short_links")
    .select("id, target_url, account_id, article_id, click_count")
    .eq("slug", slug)
    .maybeSingle();

  if (!link) {
    return NextResponse.json({ error: "link not found" }, { status: 404 });
  }

  // カウンタ更新（fire-and-forget）
  void supabase
    .from("short_links")
    .update({
      click_count: (link.click_count ?? 0) + 1,
      last_clicked_at: new Date().toISOString(),
    })
    .eq("id", link.id);

  // article_events にも記録（article に紐付いてる場合）
  if (link.article_id && link.account_id) {
    const referrer = req.headers.get("referer");
    const ua = req.headers.get("user-agent") ?? "";
    const device = /Mobi|Android|iPhone|iPad/.test(ua) ? "mobile" : "desktop";
    const sessionId =
      req.cookies.get("nhub-sid")?.value ||
      req.headers.get("x-session-hint") ||
      `go-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    void supabase.from("article_events").insert({
      session_id: sessionId,
      article_id: link.article_id,
      account_id: link.account_id,
      event_type: "cta_click",
      payload: {
        slug,
        target_url: link.target_url,
        referrer,
        device,
        source: "go_redirect",
      },
    });
  }

  return NextResponse.redirect(link.target_url, 302);
}
