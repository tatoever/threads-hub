import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicArticle, getAllPublishedArticleSlugs } from "@/lib/articles/queries";
import { ArticleView } from "@/components/article/ArticleView";

export const revalidate = 300; // ISR: 5分ごとに再検証

type PageParams = {
  accountSlug: string;
  articleSlug: string;
};

export async function generateStaticParams(): Promise<PageParams[]> {
  try {
    const list = await getAllPublishedArticleSlugs();
    return list.map((x) => ({ accountSlug: x.accountSlug, articleSlug: x.articleSlug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { accountSlug, articleSlug } = await params;
  const article = await getPublicArticle(accountSlug, articleSlug);
  if (!article) return { title: "記事が見つかりません" };

  const description =
    article.seo.description ||
    article.subtitle ||
    article.body_md.slice(0, 120).replace(/[#*`_\n]/g, " ");

  const canonical = article.seo.canonical_url || `https://note-sub.top/${accountSlug}/${articleSlug}`;

  return {
    title: article.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: article.title,
      description,
      type: "article",
      url: canonical,
      siteName: article.account.display_name ?? article.account.name,
      publishedTime: article.published_at ?? undefined,
      authors: [article.account.display_name ?? article.account.name],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { accountSlug, articleSlug } = await params;
  const article = await getPublicArticle(accountSlug, articleSlug);
  if (!article) notFound();

  return <ArticleView article={article} />;
}
