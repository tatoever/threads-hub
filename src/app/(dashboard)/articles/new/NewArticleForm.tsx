"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { upsertArticle } from "../actions";
import { isValidSlug } from "@/lib/articles/types";

export function NewArticleForm({
  accounts,
}: {
  accounts: Array<{ id: string; slug: string; displayName: string }>;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const account = accounts.find((a) => a.id === accountId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidSlug(slug)) {
      setError("slug は英数小文字・ハイフン・アンダーバーのみ（1-100文字）");
      return;
    }
    setSaving(true);
    try {
      const { id } = await upsertArticle({
        account_id: accountId,
        slug,
        title: title || "（無題）",
        body_md: "",
      });
      router.push(`/articles/${id}/edit`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div>
        <label className="text-sm font-medium block mb-1.5">アカウント</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="input-base"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName}（/{a.slug}）
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1.5">タイトル</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input-base"
          placeholder="記事タイトル（後で変更可）"
        />
      </div>

      <div>
        <label className="text-sm font-medium block mb-1.5">
          Slug（URL末尾）<span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          className="input-base font-mono"
          placeholder="article-slug"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          公開URL: /<span className="text-foreground">{account?.slug ?? "account"}</span>/
          <span className="text-foreground">{slug || "your-slug"}</span>
        </p>
      </div>

      <Button type="submit" disabled={saving || !accountId}>
        {saving ? "作成中..." : "作成してエディタを開く"}
      </Button>
    </form>
  );
}
