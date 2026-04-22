import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

/**
 * 記事ページからのイベント受信エンドポイント。
 * sendBeacon でバッチ送信される。
 *
 * Body schema:
 *   {
 *     session_id: string,
 *     article_id: string,
 *     account_id: string,
 *     device: string,
 *     referrer: string | null,
 *     events: Array<{ type, ... }>,
 *   }
 */
export const runtime = "edge";
export const preferredRegion = "iad1";

const ALLOWED_EVENTS = new Set(["view", "scroll", "dwell", "cta_click", "image_click", "exit"]);
const MAX_EVENTS_PER_REQUEST = 50;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { session_id, article_id, account_id, device, referrer, events } = body ?? {};
  if (
    typeof session_id !== "string" ||
    typeof article_id !== "string" ||
    typeof account_id !== "string" ||
    !Array.isArray(events)
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const safeEvents = events.slice(0, MAX_EVENTS_PER_REQUEST).filter((e) => ALLOWED_EVENTS.has(e?.type));
  if (safeEvents.length === 0) return NextResponse.json({ ok: true, inserted: 0 });

  const supabase = createServiceClient();

  const rows = safeEvents.map((e: any) => ({
    session_id,
    article_id,
    account_id,
    event_type: e.type,
    payload: {
      ...(e.pct !== undefined ? { scroll_pct: e.pct } : {}),
      ...(e.ms !== undefined ? { dwell_ms: e.ms } : {}),
      ...(e.cta_id !== undefined ? { cta_id: e.cta_id } : {}),
      ...(e.x !== undefined ? { x: e.x } : {}),
      ...(e.y !== undefined ? { y: e.y } : {}),
      ...(Array.isArray(e.buckets) && e.buckets.length > 0
        ? { buckets: e.buckets.slice(0, 200).map((v: any) => (typeof v === "number" ? v : 0)) }
        : {}),
      device: device ?? null,
      referrer: referrer ?? null,
    },
    occurred_at: e.at ? new Date(e.at).toISOString() : new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("article_events")
    .insert(rows, { count: "estimated" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Session upsert（初回で entry_ts を記録、後続で exit_ts / dwell / scroll 更新）
  await supabase
    .from("article_sessions")
    .upsert(
      {
        session_id,
        article_id,
        account_id,
        referrer,
        device,
      },
      { onConflict: "session_id,article_id", ignoreDuplicates: true },
    );

  return NextResponse.json({ ok: true, inserted: count ?? rows.length });
}
