"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

// react-md-editor は SSR非対応なので dynamic import
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

export interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  accountId: string;
  articleId?: string;
  height?: number;
}

export function MarkdownEditor({
  value,
  onChange,
  accountId,
  articleId,
  height = 600,
}: MarkdownEditorProps) {
  const [uploading, setUploading] = React.useState(false);

  const handlePasteOrDrop = React.useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files).find((f) => f.type.startsWith("image/"));
      if (!file) return null;

      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("image", file);
        fd.append("account_id", accountId);
        if (articleId) fd.append("article_id", articleId);
        const res = await fetch("/api/articles/upload-image", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "upload failed" }));
          throw new Error(err.error || "upload failed");
        }
        const data = await res.json();
        return data.url as string;
      } finally {
        setUploading(false);
      }
    },
    [accountId, articleId],
  );

  return (
    <div data-color-mode="light">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Markdown 記法。画像は本文エリアへ D&amp;D で自動アップロード</span>
        {uploading && <span className="text-primary">画像アップロード中…</span>}
      </div>
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? "")}
        height={height}
        preview="live"
        textareaProps={{
          placeholder: "ここに本文を書く。Markdown 記法が使える",
          style: { fontSize: 15, lineHeight: 1.75, fontFamily: "inherit" },
          onDrop: async (e: React.DragEvent<HTMLTextAreaElement>) => {
            if (!e.dataTransfer?.files?.length) return;
            e.preventDefault();
            const url = await handlePasteOrDrop(e.dataTransfer.files);
            if (url) {
              const textarea = e.currentTarget;
              const insertion = `\n\n![](${url})\n\n`;
              const pos = textarea.selectionStart ?? value.length;
              const newValue = value.slice(0, pos) + insertion + value.slice(pos);
              onChange(newValue);
            }
          },
          onPaste: async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            const imageItem = Array.from(items).find((it) => it.type.startsWith("image/"));
            if (!imageItem) return;
            e.preventDefault();
            const file = imageItem.getAsFile();
            if (!file) return;
            const url = await handlePasteOrDrop([file]);
            if (url) {
              const textarea = e.currentTarget;
              const insertion = `\n\n![](${url})\n\n`;
              const pos = textarea.selectionStart ?? value.length;
              const newValue = value.slice(0, pos) + insertion + value.slice(pos);
              onChange(newValue);
            }
          },
        }}
      />
    </div>
  );
}
