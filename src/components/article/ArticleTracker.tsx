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
    // noTrack オプトアウト
    if (typeof localStorage !== "undefined" && localStorage.getItem("noTrack") === "1") return;

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
      flush();
    };

    document.addEventListener("visibilitychange", () => {
      updateDwell();
      if (document.visibilityState === "hidden") sendDwell();
    });
    window.addEventListener("pagehide", sendDwell);

    // CTA click
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("a[data-cta-id], a[href*='a8mat'], a[href*='px.a8.net']");
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

    return () => {
      clearInterval(flushInterval);
      sendDwell();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
    };
  }, [articleId, accountId]);

  return null;
}
