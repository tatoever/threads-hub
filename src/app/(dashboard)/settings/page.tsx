"use client";

import { useState } from "react";
import { Bell, Play, Server, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/PageHeader";

export default function SettingsPage() {
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [triggering, setTriggering] = useState(false);

  async function testDiscord() {
    setTesting(true);
    setTestResult("送信中...");
    try {
      const res = await fetch("/api/settings/test-discord", { method: "POST" });
      setTestResult(res.ok ? "送信完了" : "失敗");
    } finally {
      setTesting(false);
    }
  }

  async function triggerPipeline() {
    if (!confirm("全アクティブアカウントのパイプラインを開始しますか?")) return;
    setTriggering(true);
    try {
      const secret = prompt("CRON_SECRET を入力:");
      if (!secret) return;
      const res = await fetch("/api/cron/pipeline", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      alert(JSON.stringify(data, null, 2));
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[900px]">
      <PageHeader
        title="設定"
        description="システム情報と運用ツール"
      />

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-3.5 flex items-center gap-2">
          <Server className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">システム情報</h2>
        </div>
        <dl className="divide-y divide-border">
          <InfoRow label="プロジェクト" value="threads-hub" />
          <InfoRow label="アーキテクチャ" value="Next.js + Supabase + PM2 Worker" />
          <InfoRow label="AI生成" value="ローカルCLI (claude -p)" />
          <InfoRow
            label="開発ポート"
            value={<Badge variant="outline">3900</Badge>}
          />
        </dl>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-3.5 flex items-center gap-2">
          <Play className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">手動トリガー</h2>
        </div>
        <div className="p-5">
          <button
            onClick={triggerPipeline}
            disabled={triggering}
            className="w-full text-left rounded-md border border-border bg-surface hover:bg-surface-hover transition-colors p-4 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              {triggering ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <Play className="size-5 text-primary" />
              )}
              <div>
                <p className="font-medium text-sm">朝パイプライン実行</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  全アカウントのPhase 1-4を開始
                </p>
              </div>
            </div>
          </button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-3.5 flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Discord通知テスト</h2>
        </div>
        <div className="p-5 flex items-center gap-3">
          <Button onClick={testDiscord} disabled={testing}>
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
            テスト送信
          </Button>
          {testResult && (
            <span className="text-sm text-muted-foreground">{testResult}</span>
          )}
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
