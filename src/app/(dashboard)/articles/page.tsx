import Link from "next/link";
import { listArticles } from "@/lib/articles/queries";
import { createServiceClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, ExternalLink, BarChart3, ShieldOff } from "lucide-react";
import type { ArticleListItem, ArticleStatus } from "@/lib/articles/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ArticleStatus, { label: string; variant: "secondary" | "warning" | "info" | "success" }> = {
  draft: { label: "下書き", variant: "secondary" },
  pending_review: { label: "レビュー待ち", variant: "warning" },
  published: { label: "公開中", variant: "success" },
  archived: { label: "アーカイブ", variant: "secondary" },
};

export default async function ArticlesPage() {
  const articles = await listArticles({ limit: 200 });
  const supabase = createServiceClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, slug, name, account_personas(display_name)")
    .order("created_at");

  const accountMap = new Map<string, { slug: string; displayName: string }>();
  for (const a of accounts ?? []) {
    const persona: any = Array.isArray(a.account_personas) ? a.account_personas[0] : a.account_personas;
    accountMap.set(a.id, {
      slug: a.slug,
      displayName: persona?.display_name ?? a.name,
    });
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">記事</h1>
          <p className="text-sm text-muted-foreground mt-1">
            note風の公開記事を管理する。10アカウント横断の一覧
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="https://note-sub.top/no-track"
            target="_blank"
            rel="noopener noreferrer"
            title="このブラウザをアナリティクス計測から除外する"
          >
            <Button variant="outline" size="sm">
              <ShieldOff className="size-4" /> ブラウザを計測から除外
            </Button>
          </a>
          <Link href="/articles/new">
            <Button>
              <Plus className="size-4" /> 新規作成
            </Button>
          </Link>
        </div>
      </header>

      {articles.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-12 text-center text-muted-foreground">
          まだ記事がありません。右上の「新規作成」から始めてください
        </div>
      ) : (
        <div className="rounded-md border border-border divide-y divide-border">
          {articles.map((a) => (
            <ArticleRow key={a.id} article={a} account={accountMap.get(a.account_id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArticleRow({
  article,
  account,
}: {
  article: ArticleListItem;
  account: { slug: string; displayName: string } | undefined;
}) {
  const status = STATUS_LABEL[article.status];
  const updated = new Date(article.updated_at).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-accent/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="text-xs text-muted-foreground">{account?.displayName ?? "—"}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">更新 {updated}</span>
        </div>
        <div className="font-medium truncate">{article.title || "（無題）"}</div>
        {article.subtitle && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">{article.subtitle}</div>
        )}
        <div className="text-xs text-muted-foreground mt-1">
          /<span className="text-foreground">{account?.slug ?? "?"}</span>/
          <span className="text-foreground">{article.slug}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {article.status === "published" && account && (
          <Link
            href={`/${account.slug}/${article.slug}?no-track=1`}
            target="_blank"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            title="計測除外付きで公開ページを開く"
          >
            <ExternalLink className="size-3.5" /> 表示
          </Link>
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
