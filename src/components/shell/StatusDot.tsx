import * as React from "react";
import { cn } from "@/lib/utils/cn";

type StatusTone = "active" | "testing" | "setup" | "paused" | "error" | "idle";

const toneStyles: Record<StatusTone, string> = {
  active: "bg-success shadow-[0_0_0_3px_hsl(var(--success)/0.2)]",
  testing: "bg-warning shadow-[0_0_0_3px_hsl(var(--warning)/0.2)]",
  setup: "bg-muted-foreground",
  paused: "bg-danger shadow-[0_0_0_3px_hsl(var(--danger)/0.18)]",
  error: "bg-danger shadow-[0_0_0_3px_hsl(var(--danger)/0.2)]",
  idle: "bg-muted-foreground/60",
};

export function StatusDot({
  tone = "idle",
  className,
}: {
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 rounded-full", toneStyles[tone], className)}
    />
  );
}

export function statusToTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case "active":
      return "active";
    case "testing":
      return "testing";
    case "paused":
      return "paused";
    case "setup":
      return "setup";
    default:
      return "idle";
  }
}
