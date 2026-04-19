"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Plus, Pencil, ExternalLink, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ArticleItem {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  status: "draft" | "pending_review" | "published" | "archived";
  published_at: string | null;
  updated_at: string;
  cover_image_url: string | null;
  word_count: number | null;
  reading_time_sec: number | null;
}

const STATUS_LABEL: Record<
  ArticleItem["status"],
  { label: string; variant: "secondary" | "warning" | "info" | "success" }
> = {
  draft: { label: "下書き", variant: "secondary" },
  pending_review: { label: "下書き", variant: "secondary" },
  published: { label: "公開中", variant: "success" },
  archived: { label: "アーカイブ", variant: "secondary" },
};

export function AccountArticlesList({
  accountId,
  accountSlug,
}: {
  accountId: string;
  accountSlug: string;
}) {
  const [articles, setArticles] = React.useState<ArticleItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/accounts/${accountId}/articles`)
      .then((r) => r.json())
      .then((data) => {
        setArticles(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [accountId]);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            CMS記事（内製note）
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            note-sub.top で公開する記事。ドラフトからレビュー → 公開まで管理
          </p>
        </div>
        <Link href={`/articles/new`}>
          <Button size="sm">
            <Plus className="size-4" /> 新規記事
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="p-5 space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            まだこのアカウントの記事はありません
          </p>
          <Link href="/articles/new" className="inline-block mt-3">
            <Button variant="outline" size="sm">
              <Plus className="size-4" /> 最初の記事を作成
            </Button>
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {articles.map((a) => (
            <ArticleRow key={a.id} article={a} accountSlug={accountSlug} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ArticleRow({
  article,
  accountSlug,
}: {
  article: ArticleItem;
  accountSlug: string;
}) {
  const status = STATUS_LABEL[article.status];
  const updated = new Date(article.updated_at).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const readingMin = article.reading_time_sec
    ? Math.ceil(article.reading_time_sec / 60)
    : null;
  const publicUrl = `https://note-sub.top/${accountSlug}/${article.slug}`;

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-accent/40 transition-colors">
      {article.cover_image_url && (
        <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.cover_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="text-xs text-muted-foreground">更新 {updated}</span>
          {readingMin && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{readingMin}分</span>
            </>
          )}
          {article.word_count && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{article.word_count.toLocaleString()}字</span>
            </>
          )}
        </div>
        <div className="font-medium truncate">{article.title || "（無題）"}</div>
        {article.subtitle && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {article.subtitle}
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-1 font-mono">
          /{accountSlug}/{article.slug}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {article.status === "published" && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ExternalLink className="size-3.5" /> 公開ページ
          </a>
        )}
        <Link href={`/articles/${article.id}/analytics`}>
          <Button variant="outline" size="sm">
            <BarChart3 className="size-3.5" /> 分析
          </Button>
        </Link>
        <Link href={`/articles/${article.id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" /> 編集
          </Button>
        </Link>
      </div>
    </div>
  );
}
