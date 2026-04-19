"use client";

import * as React from "react";

export function ClickHeatmap({
  points,
}: {
  points: Array<{ x: number; y: number; count: number }>;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [maxCount, setMaxCount] = React.useState(1);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // リセット
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length === 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("まだクリックデータがありません", canvas.width / 2, canvas.height / 2);
      return;
    }

    const currMax = Math.max(...points.map((p) => p.count), 1);
    setMaxCount(currMax);

    // 各ポイントを半透明の円で描画（ヒートマップ風に重なると赤く濃く）
    for (const p of points) {
      const px = p.x * canvas.width;
      const py = p.y * canvas.height;
      const intensity = p.count / currMax;
      const radius = 18 + intensity * 20;

      const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
      grad.addColorStop(0, `rgba(239, 68, 68, ${0.4 + intensity * 0.4})`);
      grad.addColorStop(0.6, `rgba(239, 68, 68, ${0.15 + intensity * 0.2})`);
      grad.addColorStop(1, "rgba(239, 68, 68, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [points]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={760}
        height={480}
        className="w-full border border-border rounded-md bg-surface-subtle"
        style={{ aspectRatio: "760/480" }}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>X軸 = 画面幅比率、Y軸 = ページ高さ比率（0=最上部、1=最下部）</span>
        {points.length > 0 && <span>最多クリック: {maxCount}</span>}
      </div>
    </div>
  );
}
