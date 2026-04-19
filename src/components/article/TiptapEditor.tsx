"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Eye,
  Pencil,
} from "lucide-react";

export interface TiptapEditorProps {
  value: string; // Markdown
  onChange: (markdown: string) => void;
  accountId: string;
  articleId?: string;
}

export function TiptapEditor({ value, onChange, accountId, articleId }: TiptapEditorProps) {
  const [uploading, setUploading] = React.useState(false);
  const [mode, setMode] = React.useState<"edit" | "preview">("edit");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false, // Markdown extension provides code block
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({
        HTMLAttributes: { loading: "lazy" },
      }),
      Placeholder.configure({
        placeholder: "ここに本文を書く。スペース感を意識して、1段落1〜2文で",
      }),
      Markdown.configure({
        html: false,
        tightLists: false,
        bulletListMarker: "-",
        linkify: true,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "note-prose note-editor-content",
        spellcheck: "false",
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const file = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        void uploadAndInsert(file);
        return true;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const item = Array.from(items).find((it) => it.type.startsWith("image/"));
        if (!item) return false;
        const file = item.getAsFile();
        if (!file) return false;
        event.preventDefault();
        void uploadAndInsert(file);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const storage = (editor.storage as Record<string, any>).markdown;
      const md: string = storage?.getMarkdown?.() ?? "";
      onChange(md);
    },
  });

  // value が外から変わったとき同期（初回エディタ構築後のみ）
  React.useEffect(() => {
    if (!editor) return;
    const storage = (editor.storage as Record<string, any>).markdown;
    const current = storage?.getMarkdown?.() ?? "";
    if (current !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const uploadAndInsert = React.useCallback(
    async (file: File) => {
      if (!editor) return;
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("image", file);
        fd.append("account_id", accountId);
        if (articleId) fd.append("article_id", articleId);
        const res = await fetch("/api/articles/upload-image", { method: "POST", body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "upload failed" }));
          throw new Error(err.error || "upload failed");
        }
        const data = await res.json();
        editor.chain().focus().setImage({ src: data.url, alt: "" }).run();
      } finally {
        setUploading(false);
      }
    },
    [editor, accountId, articleId],
  );

  if (!editor) {
    return <div className="p-6 text-sm text-muted-foreground">エディタ初期化中…</div>;
  }

  return (
    <div className="note-editor-shell">
      <div className="note-editor-toolbar">
        <div className="note-editor-toolbar-group">
          <ToolbarButton
            onClick={() => setMode("edit")}
            active={mode === "edit"}
            label="編集"
            icon={<Pencil className="size-3.5" />}
          />
          <ToolbarButton
            onClick={() => setMode("preview")}
            active={mode === "preview"}
            label="プレビュー"
            icon={<Eye className="size-3.5" />}
          />
        </div>
        {mode === "edit" && (
          <div className="note-editor-toolbar-group">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive("bold")}
              icon={<Bold className="size-3.5" />}
              title="太字 (Ctrl+B)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive("italic")}
              icon={<Italic className="size-3.5" />}
              title="斜体 (Ctrl+I)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              active={editor.isActive("strike")}
              icon={<Strikethrough className="size-3.5" />}
              title="取り消し線"
            />
            <div className="note-editor-toolbar-divider" />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive("heading", { level: 2 })}
              icon={<Heading2 className="size-3.5" />}
              title="見出し2"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor.isActive("heading", { level: 3 })}
              icon={<Heading3 className="size-3.5" />}
              title="見出し3"
            />
            <div className="note-editor-toolbar-divider" />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive("bulletList")}
              icon={<List className="size-3.5" />}
              title="箇条書き"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive("orderedList")}
              icon={<ListOrdered className="size-3.5" />}
              title="番号付きリスト"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive("blockquote")}
              icon={<Quote className="size-3.5" />}
              title="引用"
            />
            <div className="note-editor-toolbar-divider" />
            <ToolbarButton
              onClick={() => {
                const prev = editor.getAttributes("link").href ?? "";
                const url = prompt("リンクURL", prev);
                if (url === null) return;
                if (url === "") {
                  editor.chain().focus().unsetLink().run();
                } else {
                  editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                }
              }}
              active={editor.isActive("link")}
              icon={<LinkIcon className="size-3.5" />}
              title="リンク (Ctrl+K)"
            />
            <ToolbarButton
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) await uploadAndInsert(file);
                };
                input.click();
              }}
              icon={<ImageIcon className="size-3.5" />}
              title="画像挿入"
            />
            <div className="note-editor-toolbar-divider" />
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              icon={<Undo className="size-3.5" />}
              title="元に戻す (Ctrl+Z)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              icon={<Redo className="size-3.5" />}
              title="やり直す (Ctrl+Y)"
            />
          </div>
        )}
        <div className="note-editor-toolbar-spacer" />
        {uploading && <span className="text-xs text-primary">画像アップロード中…</span>}
      </div>

      <div className="note-editor-body">
        {mode === "edit" ? (
          <EditorContent editor={editor} />
        ) : (
          <PreviewPane editor={editor} />
        )}
      </div>
    </div>
  );
}

function PreviewPane({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  // エディタ内容の HTML を読み取り、読書用 .note-prose でレンダリング
  const html = editor.getHTML();
  return (
    <div className="note-editor-preview">
      <div className="note-prose" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  icon,
  title,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`note-editor-btn${active ? " is-active" : ""}`}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}
