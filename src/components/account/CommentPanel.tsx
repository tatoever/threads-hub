"use client";

import * as React from "react";
import { Check, SkipForward, MessageSquare, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

interface Comment {
  id: string;
  author_username: string | null;
  content: string | null;
  reply_status: "pending" | "approved" | "sent" | "skipped";
  reply_text: string | null;
  replied: boolean;
  created_at: string;
  posts: { content: string } | null;
}

type Filter = "all" | "pending" | "approved" | "sent" | "skipped";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "pending", label: "未対応" },
  { key: "approved", label: "承認済" },
  { key: "sent", label: "返信済" },
  { key: "skipped", label: "スキップ" },
];

const REPLY_STATUS: Record<
  Comment["reply_status"],
  { label: string; variant: "secondary" | "warning" | "info" | "success" }
> = {
  pending: { label: "未対応", variant: "warning" },
  approved: { label: "承認済", variant: "info" },
  sent: { label: "返信済", variant: "success" },
  skipped: { label: "スキップ", variant: "secondary" },
};

export function CommentPanel({ accountId }: { accountId: string }) {
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [filter, setFilter] = React.useState<Filter>("pending");
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (filter !== "all") q.set("status", filter);
    q.set("limit", "50");
    const res = await fetch(`/api/accounts/${accountId}/comments?${q.toString()}`);
    const data = await res.json();
    setComments(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [accountId, filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: comments.length };
    comments.forEach((cm) => {
      c[cm.reply_status] = (c[cm.reply_status] ?? 0) + 1;
    });
    return c;
  }, [comments]);

  async function updateStatus(id: string, reply_status: Comment["reply_status"]) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/accounts/${accountId}/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply_status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setComments((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...updated } : c)),
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">AIコメント返信</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          承認フローと返信状況
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {f.label}
              {typeof counts[f.key === "all" ? "all" : f.key] === "number" && (
                <span
                  className={cn(
                    "rounded text-[10px] tabular-nums px-1",
                    filter === f.key ? "bg-background/20" : "bg-background/40",
                  )}
                >
                  {counts[f.key === "all" ? "all" : f.key] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border max-h-[720px] overflow-y-auto">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            コメントなし
          </div>
        ) : (
          comments.map((c) => {
            const style = REPLY_STATUS[c.reply_status];
            const busy = busyId === c.id;
            return (
              <div
                key={c.id}
                className="p-4 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={style.variant}>{style.label}</Badge>
                  {c.author_username && (
                    <span className="text-xs font-medium">
                      @{c.author_username}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {formatTime(c.created_at)}
                  </span>
                </div>
                {c.posts?.content && (
                  <p className="mt-2 text-xs text-muted-foreground/80 line-clamp-1 border-l-2 border-border pl-2">
                    元投稿: {c.posts.content}
                  </p>
                )}
                <p className="mt-1.5 text-sm whitespace-pre-wrap line-clamp-3">
                  {c.content}
                </p>
                {c.reply_text && (
                  <div className="mt-2 p-2 rounded-md bg-muted/60 border border-border">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                      AI返信案
                    </p>
                    <p className="text-xs whitespace-pre-wrap">{c.reply_text}</p>
                  </div>
                )}

                {c.reply_status === "pending" && c.reply_text && (
                  <div className="mt-2 flex gap-1.5 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => updateStatus(c.id, "skipped")}
                    >
                      <SkipForward className="size-3.5" />
                      スキップ
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => updateStatus(c.id, "approved")}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      承認
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}
