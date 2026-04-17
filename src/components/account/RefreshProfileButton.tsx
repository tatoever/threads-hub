"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshProfileButton({
  accountId,
  disabled,
}: {
  accountId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function refresh() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/accounts/${accountId}/refresh-profile`,
        { method: "POST" },
      );
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "失敗" }));
        alert(`プロフィール更新失敗: ${error}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={refresh}
      disabled={busy || disabled}
      title={disabled ? "API未接続のため更新できません" : "Threadsからプロフィールを再取得"}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      プロフィール更新
    </Button>
  );
}
