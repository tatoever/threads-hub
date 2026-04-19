"use client";

import * as React from "react";

export function ReadingProgress() {
  const [pct, setPct] = React.useState(0);

  React.useEffect(() => {
    let raf: number | null = null;
    const handler = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = document.documentElement;
        const scrollTop = h.scrollTop || window.scrollY;
        const total = h.scrollHeight - h.clientHeight;
        const p = total <= 0 ? 0 : Math.min(100, Math.max(0, (scrollTop / total) * 100));
        setPct(p);
      });
    };
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => {
      window.removeEventListener("scroll", handler);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="note-reading-progress" aria-hidden>
      <div className="note-reading-progress-bar" style={{ width: `${pct}%` }} />
    </div>
  );
}
