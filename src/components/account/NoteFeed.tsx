"use client";

import * as React from "react";
import {
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  FileText,
  Copy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

interface Note {
  id: string;
  account_id: string;
  name: string;
  cta_type: string;
  url: string;
  description: string | null;
  content_body: string | null;
  tags: string[] | null;
  is_active: boolean;
  priority: number;
  total_placements: number;
  updated_at: string;
}

type Draft = {
  name: string;
  url: string;
  description: string;
  content_body: string;
  tags: string;
  is_active: boolean;
};

const emptyDraft: Draft = {
  name: "",
  url: "",
  description: "",
  content_body: "",
  tags: "",
  is_active: true,
};

export function NoteFeed({ accountId }: { accountId: string }) {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | "new" | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/accounts/${accountId}/cta`);
    const data: Note[] = await res.json();
    setNotes(
      Array.isArray(data) ? data.filter((n) => n.cta_type === "note_url") : [],
    );
    setLoading(false);
  }, [accountId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function saveDraft(draft: Draft, editId: string | "new") {
    const payload = {
      name: draft.name,
      cta_type: "note_url",
      url: draft.url,
      description: draft.description || null,
      content_body: draft.content_body || null,
      tags: draft.tags
        ? draft.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      is_active: draft.is_active,
    };

    if (editId === "new") {
      const res = await fetch(`/api/accounts/${accountId}/cta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setNotes((prev) => [created, ...prev]);
        setEditingId(null);
      } else {
        alert("保存失敗: " + (await res.text()));
      }
    } else {
      const res = await fetch(`/api/accounts/${accountId}/cta/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setNotes((prev) => prev.map((n) => (n.id === editId ? updated : n)));
        setEditingId(null);
      } else {
        alert("保存失敗: " + (await res.text()));
      }
    }
  }

  async function remove(id: string) {
    if (!confirm("このノートを削除しますか?")) return;
    const res = await fetch(`/api/accounts/${accountId}/cta/${id}`, {
      method: "DELETE",
    });
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            誘導先ノート
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            noteのタイトル・URL・本文を蓄積（テンプレ誘導ツリー参照用）
          </p>
        </div>
        {editingId !== "new" && (
          <Button size="sm" onClick={() => setEditingId("new")}>
            <Plus className="size-4" />
            ノート追加
          </Button>
        )}
      </div>

      <div className="divide-y divide-border">
        {editingId === "new" && (
          <NoteEditor
            initial={emptyDraft}
            onCancel={() => setEditingId(null)}
            onSave={(d) => saveDraft(d, "new")}
          />
        )}

        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : notes.length === 0 && editingId !== "new" ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <FileText className="size-8 text-muted-foreground/40 mx-auto mb-2" />
            ノートはまだ登録されていません
          </div>
        ) : (
          notes.map((n) =>
            editingId === n.id ? (
              <NoteEditor
                key={n.id}
                initial={{
                  name: n.name,
                  url: n.url,
                  description: n.description ?? "",
                  content_body: n.content_body ?? "",
                  tags: (n.tags ?? []).join(", "),
                  is_active: n.is_active,
                }}
                onCancel={() => setEditingId(null)}
                onSave={(d) => saveDraft(d, n.id)}
              />
            ) : (
              <NoteRow
                key={n.id}
                note={n}
                expanded={expandedId === n.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === n.id ? null : n.id))
                }
                onEdit={() => setEditingId(n.id)}
                onDelete={() => remove(n.id)}
              />
            ),
          )
        )}
      </div>
    </Card>
  );
}

function NoteRow({
  note,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  note: Note;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasBody = Boolean(note.content_body?.trim());
  return (
    <div className="p-4 hover:bg-muted/20 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{note.name}</h3>
            {note.is_active ? (
              <Badge variant="success">有効</Badge>
            ) : (
              <Badge variant="secondary">停止</Badge>
            )}
            {note.total_placements > 0 && (
              <Badge variant="outline">{note.total_placements}回配置</Badge>
            )}
          </div>
          {note.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {note.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs">
            <a
              href={note.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-[300px]"
            >
              <ExternalLink className="size-3" />
              {note.url.replace(/^https?:\/\//, "")}
            </a>
            {hasBody && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <FileText className="size-3" />
                本文 {note.content_body!.length.toLocaleString()}文字
              </span>
            )}
          </div>
          {note.tags && note.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {note.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </button>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" onClick={onEdit} title="編集">
            <Pencil className="size-4" />
          </Button>
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

      {expanded && hasBody && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              本文プレビュー
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(note.content_body ?? "");
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Copy className="size-3" />
              コピー
            </button>
          </div>
          <p className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto rounded-md bg-muted/60 border border-border p-3 text-foreground/90">
            {note.content_body}
          </p>
        </div>
      )}
    </div>
  );
}

function NoteEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: Draft;
  onCancel: () => void;
  onSave: (draft: Draft) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState<Draft>(initial);
  const [saving, setSaving] = React.useState(false);

  const valid = draft.name.trim() && draft.url.trim();

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5 bg-muted/20 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="note-name">タイトル *</Label>
          <Input
            id="note-name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="noteのタイトル"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note-url">URL *</Label>
          <Input
            id="note-url"
            type="url"
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            placeholder="https://note.com/..."
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note-desc">概要</Label>
        <Input
          id="note-desc"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="1行サマリー（任意）"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note-body">本文貼り付けゾーン</Label>
        <Textarea
          id="note-body"
          value={draft.content_body}
          onChange={(e) => setDraft({ ...draft, content_body: e.target.value })}
          rows={8}
          placeholder="noteの本文をそのまま貼り付け（後でテンプレ誘導ツリー構築時に参照されます）"
          className={cn("font-mono text-xs leading-relaxed min-h-[200px]")}
        />
        <p className="text-[10px] text-muted-foreground text-right tabular-nums">
          {draft.content_body.length.toLocaleString()}文字
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note-tags">タグ（カンマ区切り）</Label>
        <Input
          id="note-tags"
          value={draft.tags}
          onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
          placeholder="例: スピリチュアル, 開運, 初心者向け"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) =>
              setDraft({ ...draft, is_active: e.target.checked })
            }
            className="size-4 rounded border-border"
          />
          <span>有効にする</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          <X className="size-4" />
          キャンセル
        </Button>
        <Button size="sm" onClick={save} disabled={saving || !valid}>
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
