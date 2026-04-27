import { createServiceClient } from "@/lib/supabase/client";

/**
 * ダッシュボード KPI 4指標 集計
 *   - フォロワー推移 (account_daily_stats)
 *   - コメント数     (comments)
 *   - note遷移数     (article_events, event_type='view')
 *   - URLクリック数  (article_events, event_type='cta_click' + short_links.click_count)
 *
 * 各指標 3軸:
 *   - today:     JST 00:00 〜 現在
 *   - yesterday: JST 前日 00:00 〜 JST 00:00
 *   - total:     累積(全期間)
 */

export interface TripleMetric {
  today: number;
  yesterday: number;
  total: number;
}

export interface AccountKpi {
  followerDelta: TripleMetric; // today/yesterday は日別増減、totalは現在の累計
  comments: TripleMetric;
  noteViews: TripleMetric;
  urlClicks: TripleMetric;
}

export interface DashboardKpi {
  totals: AccountKpi;                         // 全10アカ合計
  byAccount: Map<string, AccountKpi>;         // account_id -> KPI
}

/** JST の今日/昨日の境界を UTC ISO で返す */
function getJstDayBoundaries() {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  const jstToday0 = new Date(Date.UTC(
    jstNow.getUTCFullYear(),
    jstNow.getUTCMonth(),
    jstNow.getUTCDate(),
    0, 0, 0
  ));
  // jstToday0 は UTC で表現された「JSTの今日0時」。UTC時刻に戻すには -9時間
  const jstTodayStartUtc = new Date(jstToday0.getTime() - 9 * 3600 * 1000);
  const jstYesterdayStartUtc = new Date(jstTodayStartUtc.getTime() - 24 * 3600 * 1000);
  return {
    todayStart: jstTodayStartUtc.toISOString(),
    yesterdayStart: jstYesterdayStartUtc.toISOString(),
    nowIso: now.toISOString(),
    // account_daily_stats の date 列用（JST基準のYYYY-MM-DD）
    todayDate: jstNow.toISOString().slice(0, 10),
    yesterdayDate: new Date(jstNow.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10),
  };
}

function emptyMetric(): TripleMetric {
  return { today: 0, yesterday: 0, total: 0 };
}

function emptyAccountKpi(): AccountKpi {
  return {
    followerDelta: emptyMetric(),
    comments: emptyMetric(),
    noteViews: emptyMetric(),
    urlClicks: emptyMetric(),
  };
}

function sumTriples(a: TripleMetric, b: TripleMetric): TripleMetric {
  return {
    today: a.today + b.today,
    yesterday: a.yesterday + b.yesterday,
    total: a.total + b.total,
  };
}

function incAccount(
  map: Map<string, AccountKpi>,
  accountId: string,
  metricKey: keyof AccountKpi,
  axisKey: keyof TripleMetric,
  delta: number,
) {
  if (!map.has(accountId)) map.set(accountId, emptyAccountKpi());
  const acc = map.get(accountId)!;
  acc[metricKey][axisKey] += delta;
}

export async function fetchDashboardKpi(accountIds: string[]): Promise<DashboardKpi> {
  const sb = createServiceClient();
  const { todayStart, yesterdayStart, todayDate, yesterdayDate } = getJstDayBoundaries();

  const byAccount = new Map<string, AccountKpi>();
  for (const id of accountIds) byAccount.set(id, emptyAccountKpi());

  // ===== 1. フォロワー推移 =====
  // today/yesterday delta: account_daily_stats の対応 date
  const { data: statsTodayYday } = await sb
    .from("account_daily_stats")
    .select("account_id, date, follower_delta, follower_count")
    .in("date", [todayDate, yesterdayDate])
    .in("account_id", accountIds);
  for (const s of statsTodayYday ?? []) {
    if (s.date === todayDate) {
      incAccount(byAccount, s.account_id, "followerDelta", "today", s.follower_delta ?? 0);
    } else if (s.date === yesterdayDate) {
      incAccount(byAccount, s.account_id, "followerDelta", "yesterday", s.follower_delta ?? 0);
    }
  }

  // total (現在の累計): 各アカで最新の follower_count
  // → account_id ごとに最新行を取る。Supabase-js では1クエリで難しいので並列
  await Promise.all(
    accountIds.map(async (id) => {
      const { data } = await sb
        .from("account_daily_stats")
        .select("follower_count")
        .eq("account_id", id)
        .not("follower_count", "is", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.follower_count != null) {
        const acc = byAccount.get(id)!;
        acc.followerDelta.total = data.follower_count;
      }
    })
  );

  // ===== 2. コメント数 =====
  const { data: commentsAll } = await sb
    .from("comments")
    .select("account_id, created_at")
    .in("account_id", accountIds);
  for (const c of commentsAll ?? []) {
    if (!c.account_id) continue;
    incAccount(byAccount, c.account_id, "comments", "total", 1);
    if (c.created_at >= todayStart) {
      incAccount(byAccount, c.account_id, "comments", "today", 1);
    } else if (c.created_at >= yesterdayStart) {
      incAccount(byAccount, c.account_id, "comments", "yesterday", 1);
    }
  }

  // ===== 3. note遷移数 (article_events where event_type='view') =====
  // 全期間の view を取得して JS で集計
  // 注意: 件数が多くなったら集計テーブルに移行する必要あり
  const { data: viewEvents } = await sb
    .from("article_events")
    .select("account_id, occurred_at")
    .eq("event_type", "view")
    .in("account_id", accountIds)
    .limit(50000);
  for (const e of viewEvents ?? []) {
    if (!e.account_id) continue;
    incAccount(byAccount, e.account_id, "noteViews", "total", 1);
    if (e.occurred_at >= todayStart) {
      incAccount(byAccount, e.account_id, "noteViews", "today", 1);
    } else if (e.occurred_at >= yesterdayStart) {
      incAccount(byAccount, e.account_id, "noteViews", "yesterday", 1);
    }
  }

  // ===== 4. URLクリック数 =====
  // today/yesterday: article_events where event_type='cta_click'
  const { data: clickEvents } = await sb
    .from("article_events")
    .select("account_id, occurred_at, payload")
    .eq("event_type", "cta_click")
    .in("account_id", accountIds)
    .gte("occurred_at", yesterdayStart)
    .limit(10000);
  for (const e of clickEvents ?? []) {
    if (!e.account_id) continue;
    if (e.occurred_at >= todayStart) {
      incAccount(byAccount, e.account_id, "urlClicks", "today", 1);
    } else if (e.occurred_at >= yesterdayStart) {
      incAccount(byAccount, e.account_id, "urlClicks", "yesterday", 1);
    }
  }
  // total: short_links.click_count の account_id 別合計
  const { data: links } = await sb
    .from("short_links")
    .select("account_id, click_count")
    .in("account_id", accountIds);
  for (const l of links ?? []) {
    if (!l.account_id) continue;
    incAccount(byAccount, l.account_id, "urlClicks", "total", l.click_count ?? 0);
  }

  // ===== totals (全10アカ合計) =====
  const totals: AccountKpi = emptyAccountKpi();
  for (const kpi of byAccount.values()) {
    totals.followerDelta = sumTriples(totals.followerDelta, kpi.followerDelta);
    totals.comments = sumTriples(totals.comments, kpi.comments);
    totals.noteViews = sumTriples(totals.noteViews, kpi.noteViews);
    totals.urlClicks = sumTriples(totals.urlClicks, kpi.urlClicks);
  }

  return { totals, byAccount };
}
