"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TiptapEditor } from "@/components/article/TiptapEditor";
import { upsertArticle, transitionArticleStatus, deleteArticle } from "../../actions";
import type { Article, ArticleStatus } from "@/lib/articles/types";
import { isValidSlug } from "@/lib/articles/types";
import { Save, Undo2, CheckCircle, Archive, ExternalLink, Trash2, BarChart3 } from "lucide-react";

interface AccountOpt {
  id: string;
  slug: string;
  displayName: string;
}

const STATUS_LABEL: Record<ArticleStatus, { label: string; variant: "secondary" | "warning" | "info" | "success" }> = {
  draft: { label: "下書き", variant: "secondary" },
  pending_review: { label: "下書き", variant: "secondary" }, // 旧状態の救済: 同等表示
  published: { label: "公開中", variant: "success" },
  archived: { label: "アーカイブ", variant: "secondary" },
};

export function ArticleEditor({
  article,
  accountOptions,
}: {
  article: Article;
  accountOptions: AccountOpt[];
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(article.title);
  const [subtitle, setSubtitle] = React.useState(article.subtitle ?? "");
  const [slug, setSlug] = React.useState(article.slug);
  const [bodyMd, setBodyMd] = React.useState(article.body_md);
  const [coverImage, setCoverImage] = React.useState(article.cover_image_url ?? "");
  const [seoDesc, setSeoDesc] = React.useState(article.seo.description ?? "");
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<ArticleStatus>(article.status);
  const [reviewNotes, setReviewNotes] = React.useState(article.review_notes ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);

  const slugValid = isValidSlug(slug);
  const account = accountOptions.find((a) => a.id === article.account_id);
  // 管理者アクセスでのアナリティクス汚染を防ぐため、公開ページリンクに ?no-track=1 を付与
  const publicUrl = account && status === "published" ? `/${account.slug}/${slug}?no-track=1` : null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await upsertArticle({
        id: article.id,
        account_id: article.account_id,
        slug,
        title,
        subtitle,
        body_md: bodyMd,
        cover_image_url: coverImage || null,
        seo: { description: seoDesc },
      });
      setLastSavedAt(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function transition(next: ArticleStatus, notes?: string) {
    setSaving(true);
    setError(null);
    try {
      await save();
      await transitionArticleStatus(article.id, next, notes);
      setStatus(next);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("この記事を完全に削除します。戻せません。よろしいですか？")) return;
    try {
      await deleteArticle(article.id);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/articles" className="text-sm text-muted-foreground hover:text-foreground">
            ← 記事一覧
          </Link>
          <Badge variant={STATUS_LABEL[status].variant}>{STATUS_LABEL[status].label}</Badge>
          <span className="text-xs text-muted-foreground">
            {account?.displayName ?? "—"}
          </span>
          {lastSavedAt && (
            <span className="text-xs text-muted-foreground">
              保存 {lastSavedAt.toLocaleTimeString("ja-JP")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/articles/${article.id}/analytics`}>
            <Button variant="outline" size="sm">
              <BarChart3 className="size-3.5" /> 分析
            </Button>
          </Link>
          <Button onClick={save} disabled={saving} variant="outline" size="sm">
            <Save className="size-3.5" /> {status === "published" ? "上書き保存" : "下書き保存"}
          </Button>
          {(status === "draft" || status === "pending_review") && (
            <Button onClick={() => transition("published")} disabled={saving || !slugValid || !title} size="sm">
              <CheckCircle className="size-3.5" /> 公開する
            </Button>
          )}
          {status === "published" && (
            <>
              {publicUrl && (
                <Link href={publicUrl} target="_blank">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="size-3.5" /> 公開ページ
                  </Button>
                </Link>
              )}
              <Button onClick={() => transition("draft")} variant="outline" size="sm">
                <Undo2 className="size-3.5" /> 下書きに戻す
              </Button>
              <Button onClick={() => transition("archived")} variant="outline" size="sm">
                <Archive className="size-3.5" /> アーカイブ
              </Button>
            </>
          )}
          <Button onClick={handleDelete} variant="outline" size="sm" className="text-destructive">
            <Trash2 className="size-3.5" /> 削除
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {reviewNotes && status === "draft" && (
        <div className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <div className="font-medium text-amber-800 dark:text-amber-400 mb-1">差し戻しコメント</div>
          <div className="text-amber-900 dark:text-amber-200 whitespace-pre-line">{reviewNotes}</div>
        </div>
      )}

      <div className="space-y-4">
        <Field label="タイトル" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-base"
            placeholder="記事タイトル"
            maxLength={120}
          />
        </Field>

        <Field label="サブタイトル（任意）">
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="input-base"
            placeholder="記事の副題・リード文"
            maxLength={200}
          />
        </Field>

        <Field
          label="Slug (URL 末尾)"
          required
          hint={`公開URL例: /${account?.slug}/${slug || "your-slug"}`}
          error={!slugValid ? "英数小文字・ハイフン・アンダーバーのみ（1-100文字）" : null}
        >
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="input-base font-mono"
            placeholder="article-slug"
            maxLength={100}
          />
        </Field>

        <Field label="カバー画像URL（任意）" hint="ヘッダー上部に表示される画像">
          <input
            type="text"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            className="input-base"
            placeholder="https://..."
          />
        </Field>

        <Field label="本文" required>
          <TiptapEditor
            value={bodyMd}
            onChange={setBodyMd}
            accountId={article.account_id}
            articleId={article.id}
          />
        </Field>

        <Field
          label="meta description（SEO用、任意）"
          hint="検索結果やSNSシェア時に表示される説明文。120字前後推奨"
        >
          <textarea
            value={seoDesc}
            onChange={(e) => setSeoDesc(e.target.value)}
            className="input-base min-h-[80px]"
            rows={3}
            maxLength={200}
            placeholder="記事の簡潔な説明"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <div className="text-xs text-destructive mt-1">{error}</div>}
    </div>
  );
}
