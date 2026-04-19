import type { MetadataRoute } from "next";
import { getAllPublishedArticleSlugs } from "@/lib/articles/queries";

const BASE = "https://note-sub.top";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getAllPublishedArticleSlugs().catch(() => []);
  const articleEntries: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${BASE}/${a.accountSlug}/${a.articleSlug}`,
    lastModified: a.publishedAt ? new Date(a.publishedAt) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...articleEntries,
  ];
}
