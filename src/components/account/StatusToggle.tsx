"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StatusToggle({
  accountId,
  currentStatus,
}: {
  accountId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [updating, setUpdating] = React.useState(false);

  async function toggle() {
    setUpdating(true);
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      router.refresh();
    } finally {
      setUpdating(false);
    }
  }

  if (currentStatus === "setup") return null;

  const isActive = currentStatus === "active";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={updating}
    >
      {updating ? (
        <Loader2 className="size-4 animate-spin" />
      ) : isActive ? (
        <Pause className="size-4" />
      ) : (
        <Play className="size-4" />
      )}
      {isActive ? "一時停止" : "再開"}
    </Button>
  );
}
