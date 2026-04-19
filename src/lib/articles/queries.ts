import { createServiceClient } from "@/lib/supabase/client";
import type { Article, ArticleListItem, PublicArticleView, ArticleStatus } from "./types";

/**
 * 公開記事を account slug + article slug で取得する。
 * anon client でも取れるが、service client の方が RLS 関係なく安定。
 * ISR で使うので、build 時実行時は ENV の service_role 必須。
 */
export async function getPublicArticle(
  accountSlug: string,
  articleSlug: string,
): Promise<PublicArticleView | null> {
  const supabase = createServiceClient();

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, slug, profile_picture_url, profile_bio, account_personas(display_name, background, genre)")
    .eq("slug", accountSlug)
    .maybeSingle();

  if (!account) return null;

  const persona: any = Array.isArray(account.account_personas)
    ? account.account_personas[0]
    : account.account_personas;

  const { data: article } = await supabase
    .from("articles")
    .select(
      "id, slug, title, subtitle, body_md, cover_image_url, og_image_url, published_at, reading_time_sec, seo",
    )
    .eq("account_id", account.id)
    .eq("slug", articleSlug)
    .eq("status", "published")
    .maybeSingle();

  if (!article) return null;

  return {
    ...article,
    seo: (article.seo as PublicArticleView["seo"]) || {},
    account: {
      id: account.id,
      slug: account.slug,
      name: account.name,
      display_name: persona?.display_name ?? null,
      background: persona?.background ?? null,
      genre: persona?.genre ?? null,
      profile_picture_url: (account as any).profile_picture_url ?? null,
      profile_bio: (account as any).profile_bio ?? null,
    },
  };
}

/**
 * 全公開記事のスラッグ一覧（sitemap, generateStaticParams 用）
 */
export async function getAllPublishedArticleSlugs(): Promise<
  Array<{ accountSlug: string; articleSlug: string; publishedAt: string | null }>
> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("articles")
    .select("slug, published_at, accounts!inner(slug)")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (!data) return [];
  return data.map((row: any) => ({
    accountSlug: row.accounts.slug,
    articleSlug: row.slug,
    publishedAt: row.published_at,
  }));
}

/**
 * 管理画面用: 記事一覧（アカウントフィルタ・ステータスフィルタ対応）
 */
export async function listArticles(options?: {
  accountId?: string;
  status?: ArticleStatus;
  limit?: number;
}): Promise<ArticleListItem[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("articles")
    .select("id, account_id, slug, title, subtitle, status, published_at, updated_at, cover_image_url")
    .order("updated_at", { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.accountId) query = query.eq("account_id", options.accountId);
  if (options?.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ArticleListItem[];
}

export async function getArticleById(id: string): Promise<Article | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
  return (data as Article) || null;
}
