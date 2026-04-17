"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
} as const;

type Size = keyof typeof SIZES;

function deriveInitials(name?: string | null) {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const first = Array.from(trimmed)[0];
  return first ? first.toUpperCase() : "?";
}

function hashHue(seed?: string | null) {
  if (!seed) return 220;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return h % 360;
}

export function Avatar({
  src,
  name,
  seed,
  size = "md",
  className,
  ring = false,
}: {
  src?: string | null;
  name?: string | null;
  seed?: string | null;
  size?: Size;
  className?: string;
  ring?: boolean;
}) {
  const [errored, setErrored] = React.useState(false);
  const showImage = Boolean(src && !errored);
  const initial = deriveInitials(name);
  const hue = hashHue(seed ?? name);

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center shrink-0 overflow-hidden rounded-full font-semibold text-white",
        SIZES[size],
        ring && "ring-2 ring-background shadow-sm",
        className,
      )}
      style={
        showImage
          ? undefined
          : {
              background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 35) % 360} 70% 45%))`,
            }
      }
    >
      {showImage ? (
        <img
          src={src!}
          alt={name ?? ""}
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
        />
      ) : (
        <span aria-hidden>{initial}</span>
      )}
    </span>
  );
}
