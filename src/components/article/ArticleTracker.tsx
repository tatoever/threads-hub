"use client";

import * as React from "react";

/**
 * 記事ページ上のイベント計測。Cookieless、sendBeacon ベース。
 * - view: ページロード時1回
 * - scroll: 25/50/75/100% 到達時（各1回）
 * - dwell: visibilitychange="hidden" / pagehide で累積滞在送信
 * - cta_click: data-cta-click 属性持つリンクのクリック
 */
export function ArticleTracker({ articleId, accountId }: { articleId: string; accountId: string }) {
  React.useEffect(() => {
    // URL パラメータでの即時切替
    //   ?no-track=1 → このブラウザを計測から除外 (localStorage.noTrack=1)
    //   ?no-track=0 → 除外解除
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get("no-track") ?? params.get("noTrack");
      if (v === "1") {
        localStorage.setItem("noTrack", "1");
      } else if (v === "0") {
        localStorage.removeItem("noTrack");
      }
    } catch {}

    // noTrack オプトアウト（除外中なら last_seen_at だけ更新して return）
    if (typeof localStorage !== "undefined" && localStorage.getItem("noTrack") === "1") {
      try {
        const did = localStorage.getItem("noTrackDeviceId");
        if (did) {
          const body = JSON.stringify({ device_id: did });
          if (navigator.sendBeacon) {
            navigator.sendBeacon("/api/no-track/ping", new Blob([body], { type: "application/json" }));
          } else {
            fetch("/api/no-track/ping", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
              keepalive: true,
            }).catch(() => {});
          }
        }
      } catch {}
      return;
    }

    // Session ID: sessionStorage（Cookieless）
    const SESSION_KEY = "nhub:sid";
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId =
        typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `sid-${Date.now()}-${Math.random()}`;
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }

    const device = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) ? "mobile" : "desktop";
    const referrer = document.referrer ? new URL(document.referrer).host : null;

    // イベントバッファ
    const buffer: any[] = [];
    const flush = () => {
      if (buffer.length === 0) return;
      const body = JSON.stringify({
        session_id: sessionId,
        article_id: articleId,
        account_id: accountId,
        device,
        referrer,
        events: buffer.splice(0, buffer.length),
      });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/events/ingest", blob);
      } else {
        fetch("/api/events/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };

    // view
    buffer.push({ type: "view", at: Date.now() });

    // バッファを5秒ごとフラッシュ
    const flushInterval = setInterval(flush, 5000);

    // スクロール深度
    const scrollMarkers = [25, 50, 75, 100];
    const scrollSent = new Set<number>();
    const onScroll = () => {
      const h = document.documentElement;
      const scrollTop = h.scrollTop || window.scrollY;
      const total = h.scrollHeight - h.clientHeight;
      if (total <= 0) return;
      const pct = Math.min(100, Math.max(0, (scrollTop / total) * 100));
      for (const m of scrollMarkers) {
        if (pct >= m && !scrollSent.has(m)) {
          scrollSent.add(m);
          buffer.push({ type: "scroll", pct: m, at: Date.now() });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // ビューポート滞在ヒートマップ:
    //   100バケット（ページ高さを1%刻みに分割）それぞれに対して、
    //   そのY範囲がビューポートに表示されていた累積時間(ms)を記録する
    const HEAT_BUCKETS = 100;
    const bucketTimeMs = new Array<number>(HEAT_BUCKETS).fill(0);
    let lastSampleAt = Date.now();
    const sampleViewport = () => {
      const now = Date.now();
      const dt = now - lastSampleAt;
      lastSampleAt = now;
      if (document.visibilityState !== "visible") return;
      if (dt <= 0 || dt > 60_000) return; // 60秒以上はタブ離脱とみなして捨てる

      const h = document.documentElement;
      const scrollTop = h.scrollTop || window.scrollY;
      const viewportH = h.clientHeight;
      const total = h.scrollHeight;
      if (total <= 0 || viewportH <= 0) return;

      const topPct = Math.max(0, Math.min(1, scrollTop / total));
      const botPct = Math.max(0, Math.min(1, (scrollTop + viewportH) / total));
      const topIdx = Math.floor(topPct * HEAT_BUCKETS);
      const botIdx = Math.min(HEAT_BUCKETS - 1, Math.ceil(botPct * HEAT_BUCKETS) - 1);
      for (let i = topIdx; i <= botIdx; i++) bucketTimeMs[i] += dt;
    };
    const sampleInterval = setInterval(sampleViewport, 1000);

    const sendHeatmap = () => {
      sampleViewport();
      const total = bucketTimeMs.reduce((a, b) => a + b, 0);
      if (total < 500) return; // 0.5秒未満のデータは無視
      buffer.push({
        type: "scroll",
        // 既存の scroll イベントを相乗り。集計側は payload.buckets の有無で判別
        buckets: bucketTimeMs.map((v) => Math.round(v)),
        at: Date.now(),
      });
      // 送信したら累積はリセット
      for (let i = 0; i < HEAT_BUCKETS; i++) bucketTimeMs[i] = 0;
    };

    // 滞在時間
    let dwellAccumulated = 0;
    let lastVisibleAt: number | null = Date.now();
    const updateDwell = () => {
      if (document.visibilityState === "visible") {
        if (lastVisibleAt === null) lastVisibleAt = Date.now();
      } else {
        if (lastVisibleAt !== null) {
          dwellAccumulated += Date.now() - lastVisibleAt;
          lastVisibleAt = null;
        }
      }
    };
    const sendDwell = () => {
      updateDwell();
      buffer.push({ type: "dwell", ms: dwellAccumulated, at: Date.now() });
      sendHeatmap();
      flush();
    };

    document.addEventListener("visibilitychange", () => {
      updateDwell();
      if (document.visibilityState === "hidden") sendDwell();
    });
    window.addEventListener("pagehide", sendDwell);

    // CTA click: data-cta-id / A8直リンク / note-sub.top 短縮リンク を全部拾う
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.(
        "a[data-cta-id], a[href*='a8mat'], a[href*='px.a8.net'], a[href*='note-sub.top/go/'], a[href*='/go/']"
      );
      if (!target) return;
      const ctaId = target.getAttribute("data-cta-id") || target.getAttribute("href") || "";
      const rect = (target as HTMLElement).getBoundingClientRect();
      buffer.push({
        type: "cta_click",
        cta_id: ctaId.slice(0, 200),
        x: e.clientX / window.innerWidth,
        y: (window.scrollY + e.clientY) / document.documentElement.scrollHeight,
        at: Date.now(),
      });
      flush();
    };
    document.addEventListener("click", onClick);

    // 定期的にヒートマップデータも送信（長時間滞在セッションで失われないように60秒毎）
    const heatmapInterval = setInterval(() => {
      sendHeatmap();
    }, 60_000);

    return () => {
      clearInterval(flushInterval);
      clearInterval(sampleInterval);
      clearInterval(heatmapInterval);
      sendDwell();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
    };
  }, [articleId, accountId]);

  return null;
}
