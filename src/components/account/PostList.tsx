"use client";

import * as React from "react";
import {
  Calendar,
  Check,
  Clock,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea, Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

type Status = "all" | "draft" | "pending_review" | "approved" | "published" | "failed";

interface Post {
  id: string;
  account_id: string;
  content: string;
  status: Exclude<Status, "all">;
  scheduled_at: string | null;
  published_at: string | null;
  reply_1: string | null;
  reply_2: string | null;
  template_type: string | null;
  slot_number: number | null;
  threads_post_id: string | null;
  metrics: any;
  created_at: string;
}

const STATUS_TABS: { key: Status; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "draft", label: "下書き" },
  { key: "pending_review", label: "レビュー待ち" },
  { key: "approved", label: "承認済" },
  { key: "published", label: "公開済" },
  { key: "failed", label: "失敗" },
];

const STATUS_STYLE: Record<
  Exclude<Status, "all">,
  { label: string; variant: "secondary" | "warning" | "info" | "success" | "danger" }
> = {
  draft: { label: "下書き", variant: "secondary" },
  pending_review: { label: "レビュー待ち", variant: "warning" },
  approved: { label: "承認済", variant: "info" },
  published: { label: "公開済", variant: "success" },
  failed: { label: "失敗", variant: "danger" },
};

export function PostList({ accountId }: { accountId: string }) {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [status, setStatus] = React.useState<Status>("all");
  const [loading, setLoading] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (status !== "all") q.set("status", status);
    const res = await fetch(
      `/api/accounts/${accountId}/posts?${q.toString()}`,
    );
    const data = await res.json();
    setPosts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [accountId, status]);

  React.useEffect(() => {
    load();
  }, [load]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: posts.length };
    posts.forEach((p) => {
      c[p.status] = (c[p.status] ?? 0) + 1;
    });
    return c;
  }, [posts]);

  async function updatePost(postId: string, patch: Partial<Post>) {
    const res = await fetch(`/api/accounts/${accountId}/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, ...updated } : p)),
      );
    }
  }

  async function deletePost(postId: string) {
    if (!confirm("この投稿を削除しますか?")) return;
    const res = await fetch(`/api/accounts/${accountId}/posts/${postId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold">投稿管理</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              予約・ステータス・編集を一括管理
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                status === t.key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {t.label}
              {typeof counts[t.key === "all" ? "all" : t.key] === "number" && (
                <span
                  className={cn(
                    "rounded text-[10px] tabular-nums px-1",
                    status === t.key ? "bg-background/20" : "bg-background/40",
                  )}
                >
                  {counts[t.key === "all" ? "all" : t.key] ?? 0}
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
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            投稿がありません
          </div>
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              editing={editingId === p.id}
              onEdit={() => setEditingId(p.id)}
              onCancel={() => setEditingId(null)}
              onSave={async (patch) => {
                await updatePost(p.id, patch);
                setEditingId(null);
              }}
              onDelete={() => deletePost(p.id)}
              onApprove={() => updatePost(p.id, { status: "approved" })}
              onReject={() => updatePost(p.id, { status: "draft" })}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function PostCard({
  post,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onApprove,
  onReject,
}: {
  post: Post;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<Post>) => Promise<void>;
  onDelete: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [content, setContent] = React.useState(post.content);
  const [scheduledAt, setScheduledAt] = React.useState(
    post.scheduled_at ? toLocalDatetimeInput(post.scheduled_at) : "",
  );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (editing) {
      setContent(post.content);
      setScheduledAt(
        post.scheduled_at ? toLocalDatetimeInput(post.scheduled_at) : "",
      );
    }
  }, [editing, post.content, post.scheduled_at]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        content,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
    } finally {
      setSaving(false);
    }
  }

  const style = STATUS_STYLE[post.status];
  const scheduleTime = post.scheduled_at
    ? new Date(post.scheduled_at)
    : null;
  const published = post.status === "published";

  if (editing) {
    return (
      <div className="p-5 bg-muted/30 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant={style.variant}>{style.label}</Badge>
          {post.slot_number !== null && (
            <span className="text-xs text-muted-foreground">
              スロット {post.slot_number}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`content-${post.id}`}>本文</Label>
          <Textarea
            id={`content-${post.id}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            maxLength={500}
          />
          <p className="text-[10px] text-muted-foreground text-right tabular-nums">
            {content.length} / 500
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`schedule-${post.id}`}>予約日時 (JST)</Label>
          <Input
            id={`schedule-${post.id}`}
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            <X className="size-4" />
            キャンセル
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            保存
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 hover:bg-muted/20 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={style.variant}>{style.label}</Badge>
            {post.template_type && (
              <Badge variant="outline">{post.template_type}</Badge>
            )}
            {scheduleTime && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                {published ? <Check className="size-3" /> : <Clock className="size-3" />}
                {formatJst(scheduleTime)}
              </span>
            )}
            {post.slot_number !== null && (
              <span className="text-xs text-muted-foreground/80">
                · slot {post.slot_number}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-foreground whitespace-pre-wrap line-clamp-4">
            {post.content}
          </p>
          {(post.reply_1 || post.reply_2) && (
            <div className="mt-2 pl-3 border-l-2 border-border space-y-1">
              {post.reply_1 && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-2">
                  ↳ {post.reply_1}
                </p>
              )}
              {post.reply_2 && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-2">
                  ↳ {post.reply_2}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {post.status === "pending_review" && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onApprove}
              title="承認"
              className="text-success hover:text-success"
            >
              <Check className="size-4" />
            </Button>
          )}
          {post.status === "approved" && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onReject}
              title="予約取消"
              className="text-warning hover:text-warning"
            >
              <X className="size-4" />
            </Button>
          )}
          {!published && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onEdit}
              title="編集"
            >
              <Pencil className="size-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            title="削除"
            className="text-danger hover:text-danger"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function toLocalDatetimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatJst(d: Date) {
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
