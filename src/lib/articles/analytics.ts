import { createServiceClient } from "@/lib/supabase/client";

export interface ArticleAnalyticsSummary {
  articleId: string;
  totalViews: number;
  uniqueSessions: number;
  avgDwellMs: number | null;
  scrollReach: {
    p25: number; // 到達率 0-1
    p50: number;
    p75: number;
    p100: number;
  };
  ctaClicks: number;
  ctr: number; // cta_clicks / views
  topReferrers: Array<{ referrer: string; count: number }>;
  devices: { mobile: number; desktop: number; other: number };
  heatmapPoints: Array<{ x: number; y: number; count: number }>;
  shortLinks: Array<{ slug: string; target_url: string; click_count: number }>;
}

/**
 * 記事の包括的な分析サマリを返す。article_events + article_sessions + short_links を集計。
 */
export async function getArticleAnalytics(articleId: string): Promise<ArticleAnalyticsSummary> {
  const supabase = createServiceClient();

  // 基本イベント集計
  const { data: events } = await supabase
    .from("article_events")
    .select("event_type, payload, session_id")
    .eq("article_id", articleId)
    .limit(50_000);

  const eventList = events ?? [];

  const viewEvents = eventList.filter((e) => e.event_type === "view");
  const dwellEvents = eventList.filter((e) => e.event_type === "dwell");
  const scrollEvents = eventList.filter((e) => e.event_type === "scroll");
  const ctaEvents = eventList.filter((e) => e.event_type === "cta_click");

  const uniqueSessions = new Set(viewEvents.map((e) => e.session_id)).size;

  // dwell: 各セッションの最大値の平均
  const dwellBySession = new Map<string, number>();
  for (const e of dwellEvents) {
    const ms = (e.payload as any)?.dwell_ms;
    if (typeof ms === "number") {
      const prev = dwellBySession.get(e.session_id) ?? 0;
      if (ms > prev) dwellBySession.set(e.session_id, ms);
    }
  }
  const avgDwellMs = dwellBySession.size > 0
    ? Math.round(Array.from(dwellBySession.values()).reduce((a, b) => a + b, 0) / dwellBySession.size)
    : null;

  // scroll: マーカー別の到達セッション率
  const reachedBySession: Record<number, Set<string>> = { 25: new Set(), 50: new Set(), 75: new Set(), 100: new Set() };
  for (const e of scrollEvents) {
    const pct = (e.payload as any)?.scroll_pct;
    if (pct === 25 || pct === 50 || pct === 75 || pct === 100) {
      reachedBySession[pct].add(e.session_id);
    }
  }
  const totalForScroll = Math.max(uniqueSessions, 1);
  const scrollReach = {
    p25: reachedBySession[25].size / totalForScroll,
    p50: reachedBySession[50].size / totalForScroll,
    p75: reachedBySession[75].size / totalForScroll,
    p100: reachedBySession[100].size / totalForScroll,
  };

  // referrer / device（view イベントから）
  const refCounts = new Map<string, number>();
  const deviceCounts = { mobile: 0, desktop: 0, other: 0 };
  for (const e of viewEvents) {
    const ref = (e.payload as any)?.referrer;
    const refKey = normalizeReferrer(ref);
    refCounts.set(refKey, (refCounts.get(refKey) ?? 0) + 1);

    const dev = (e.payload as any)?.device;
    if (dev === "mobile") deviceCounts.mobile++;
    else if (dev === "desktop") deviceCounts.desktop++;
    else deviceCounts.other++;
  }
  const topReferrers = Array.from(refCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([referrer, count]) => ({ referrer, count }));

  // ヒートマップ: cta_click の x,y をバケット化
  const bucketSize = 0.02; // 50x50 グリッド
  const heatmapBuckets = new Map<string, number>();
  for (const e of ctaEvents) {
    const x = (e.payload as any)?.x;
    const y = (e.payload as any)?.y;
    if (typeof x === "number" && typeof y === "number" && x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      const bx = Math.floor(x / bucketSize) * bucketSize;
      const by = Math.floor(y / bucketSize) * bucketSize;
      const key = `${bx.toFixed(3)}|${by.toFixed(3)}`;
      heatmapBuckets.set(key, (heatmapBuckets.get(key) ?? 0) + 1);
    }
  }
  const heatmapPoints = Array.from(heatmapBuckets.entries()).map(([key, count]) => {
    const [bx, by] = key.split("|").map(Number);
    return { x: bx + bucketSize / 2, y: by + bucketSize / 2, count };
  });

  // short_links（記事紐付き）
  const { data: shortLinks } = await supabase
    .from("short_links")
    .select("slug, target_url, click_count")
    .eq("article_id", articleId)
    .order("click_count", { ascending: false });

  const totalViews = viewEvents.length;
  const ctr = totalViews > 0 ? ctaEvents.length / totalViews : 0;

  return {
    articleId,
    totalViews,
    uniqueSessions,
    avgDwellMs,
    scrollReach,
    ctaClicks: ctaEvents.length,
    ctr,
    topReferrers,
    devices: deviceCounts,
    heatmapPoints,
    shortLinks: shortLinks ?? [],
  };
}

function normalizeReferrer(ref: string | null | undefined): string {
  if (!ref) return "(direct)";
  if (ref.includes("threads.net") || ref.includes("threads.com")) return "Threads";
  if (ref.includes("t.co") || ref.includes("twitter.com") || ref.includes("x.com")) return "X (Twitter)";
  if (ref.includes("instagram.com")) return "Instagram";
  if (ref.includes("line.me")) return "LINE";
  if (ref.includes("google.")) return "Google 検索";
  if (ref.includes("bing.com") || ref.includes("yahoo.")) return "検索エンジン";
  if (ref.includes("note.com")) return "note.com";
  return ref.slice(0, 40);
}
