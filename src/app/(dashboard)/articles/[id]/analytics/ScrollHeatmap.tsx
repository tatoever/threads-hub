"use client";

import * as React from "react";

/**
 * スクロール滞在ヒートマップ。
 * 長さ100のバケット配列（各要素: そのY位置でビューポート表示されていた累積秒数）を
 * 縦長のバーで可視化する。
 *
 * 色は青 (hue 220, 低関心) → 赤 (hue 0, 高関心) のグラデーション。
 * 正規化は「最大バケット値 = 赤」基準。
 */
export function ScrollHeatmap({ buckets }: { buckets: number[] }) {
  if (!buckets || buckets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        まだデータがありません（記事が読まれると蓄積されます）
      </p>
    );
  }

  const max = Math.max(1, ...buckets);
  const total = buckets.reduce((a, b) => a + b, 0);

  // ホットゾーン抽出（上位5位）
  const ranked = buckets
    .map((v, i) => ({ idx: i, sec: v }))
    .sort((a, b) => b.sec - a.sec)
    .slice(0, 5);

  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* ヒートマップ本体: 上が記事冒頭、下が記事末尾 */}
      <div className="flex gap-4">
        {/* カラムヘッダー (Y%) */}
        <div className="flex flex-col justify-between text-[10px] text-muted-foreground tabular-nums py-1 w-8 text-right">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>

        {/* ヒートマップバー */}
        <div
          className="relative flex-1 rounded-md overflow-hidden border border-border"
          style={{ minHeight: 400 }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <div className="absolute inset-0 flex flex-col">
            {buckets.map((sec, i) => {
              const ratio = sec / max; // 0..1
              const hue = Math.round(220 - 220 * ratio); // 220 → 0
              const sat = 55 + Math.round(25 * ratio);
              const light = 75 - Math.round(30 * ratio);
              const bg = `hsl(${hue}deg ${sat}% ${light}%)`;
              return (
                <div
                  key={i}
                  className="flex-1 w-full cursor-crosshair"
                  style={{ background: bg }}
                  onMouseEnter={() => setHoverIdx(i)}
                />
              );
            })}
          </div>
          {hoverIdx !== null && (
            <div
              className="absolute right-2 rounded-md bg-black/80 text-white text-xs px-2 py-1 pointer-events-none whitespace-nowrap"
              style={{
                top: `min(calc(${hoverIdx}% - 10px), calc(100% - 28px))`,
              }}
            >
              Y {hoverIdx}% — {buckets[hoverIdx].toFixed(1)}秒
            </div>
          )}
        </div>

        {/* 凡例 */}
        <div className="flex flex-col items-center gap-2 text-[10px] text-muted-foreground">
          <span>熱い</span>
          <div
            className="w-3 flex-1 rounded-sm border border-border"
            style={{
              minHeight: 240,
              background:
                "linear-gradient(to bottom, hsl(0deg 80% 45%), hsl(55deg 80% 55%), hsl(130deg 55% 65%), hsl(220deg 55% 75%))",
            }}
          />
          <span>冷たい</span>
        </div>
      </div>

      {/* サマリ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-border p-3 bg-surface-subtle">
          <p className="text-xs text-muted-foreground mb-1">全セッション累積表示時間</p>
          <p className="text-lg font-semibold tabular-nums">
            {Math.round(total).toLocaleString()}秒
            <span className="text-xs font-normal text-muted-foreground ml-2">
              （{(total / 60).toFixed(1)}分）
            </span>
          </p>
        </div>
        <div className="rounded-md border border-border p-3 bg-surface-subtle">
          <p className="text-xs text-muted-foreground mb-1">最も見られているY位置 Top 5</p>
          <ul className="text-xs space-y-0.5 tabular-nums">
            {ranked.map((r) => (
              <li key={r.idx} className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground w-10">Y {r.idx}%</span>
                <span className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <span
                    className="block h-full"
                    style={{
                      width: `${(r.sec / max) * 100}%`,
                      background: `hsl(${Math.round(220 - 220 * (r.sec / max))}deg 70% 50%)`,
                    }}
                  />
                </span>
                <span className="text-muted-foreground">{r.sec.toFixed(1)}秒</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
