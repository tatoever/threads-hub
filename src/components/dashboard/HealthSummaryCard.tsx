"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stethoscope, Clipboard, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type CheckEntry = {
  label: string;
  status: "green" | "yellow" | "red";
  value: string;
  detail?: string | string[];
};

export interface HealthSummary {
  date: string;
  overall: "green" | "yellow" | "red";
  checks: Record<string, CheckEntry>;
  summary_markdown: string;
  action_required: boolean;
  created_at: string;
}

const overallStyles = {
  green:  { label: "🟢 正常",    classes: "border-success/40 bg-success-muted/30" },
  yellow: { label: "🟡 要注意", classes: "border-warning/40 bg-warning-muted/30" },
  red:    { label: "🔴 要相談", classes: "border-danger/40 bg-danger-muted/30" },
} as const;

const iconFor = (s: string) => s === "green" ? "✅" : s === "yellow" ? "🟡" : "🔴";

export function HealthSummaryCard({ summary }: { summary: HealthSummary | null }) {
  const [copied, setCopied] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const onCopy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.summary_markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const onManualRun = async () => {
    setRefreshing(true);
    try {
      // cookie (threads-hub-session) 認証経由で呼び出す
      const res = await fetch("/api/cron/morning-health", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const body = await res.text();
        alert("実行失敗: " + res.status + "\n" + body.slice(0, 300));
      }
    } catch (e: any) {
      alert("エラー: " + e.message);
    } finally {
      setRefreshing(false);
    }
  };

  if (!summary) {
    return (
      <Card className="p-5 border-border/60 bg-muted/20">
        <div className="flex items-center gap-3">
          <Stethoscope className="size-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">本日の健康診断</p>
            <p className="text-xs text-muted-foreground">
              まだ実行されていません。朝 JST 07:00 に自動実行されます。
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onManualRun} disabled={refreshing}>
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            今すぐ実行
          </Button>
        </div>
      </Card>
    );
  }

  const style = overallStyles[summary.overall];
  const jstTime = new Date(summary.created_at).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card className={cn("p-5 border space-y-4", style.classes)}>
      {/* ヘッダー */}
      <div className="flex items-center gap-3 flex-wrap">
        <Stethoscope className="size-5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold">本日の健康診断</h2>
            <span className="text-xs text-muted-foreground font-mono">{summary.date}</span>
            <Badge variant={summary.overall === "red" ? "danger" : summary.overall === "yellow" ? "warning" : "success"}>
              {style.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {jstTime} 実行
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCopy}>
            {copied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}
            {copied ? "コピー済み" : "Claude相談用にコピー"}
          </Button>
          <Button variant="outline" size="sm" onClick={onManualRun} disabled={refreshing}>
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            再実行
          </Button>
        </div>
      </div>

      {/* チェック項目リスト */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {Object.entries(summary.checks).map(([key, c]) => (
          <CheckRow key={key} entry={c as CheckEntry} />
        ))}
      </div>

      {summary.action_required && (
        <p className="text-xs text-muted-foreground pt-2 border-t border-border/40">
          💡 「Claude相談用にコピー」ボタンを押すと、状況を Markdown でコピーできます。
          そのまま Claude のチャットに貼り付けて相談できます。
        </p>
      )}
    </Card>
  );
}

function CheckRow({ entry }: { entry: CheckEntry }) {
  const icon = iconFor(entry.status);
  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-background/40">
      <span className="text-base leading-none mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{entry.label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{entry.value}</span>
        </div>
        {entry.detail && (
          <div className="text-[11px] text-muted-foreground mt-1">
            {Array.isArray(entry.detail)
              ? entry.detail.map((d, i) => <div key={i}>・{d}</div>)
              : `・${entry.detail}`}
          </div>
        )}
      </div>
    </div>
  );
}
