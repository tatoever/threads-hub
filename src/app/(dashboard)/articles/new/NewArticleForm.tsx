"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { upsertArticle } from "../actions";
import { generateRandomSlug } from "@/lib/articles/types";

export function NewArticleForm({
  accounts,
}: {
  accounts: Array<{ id: string; slug: string; displayName: string }>;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [title, setTitle] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const account = accounts.find((a) => a.id === accountId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // slug は自動生成（note.com 風 n + 12文字の英数字）
      const slug = generateRandomSlug();
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

      <div className="text-xs text-muted-foreground">
        公開URLは自動生成されます（例:{" "}
        <span className="font-mono">/{account?.slug ?? "account"}/n1a734e59e205</span>）
      </div>

      <Button type="submit" disabled={saving || !accountId}>
        {saving ? "作成中..." : "作成してエディタを開く"}
      </Button>
    </form>
  );
}
