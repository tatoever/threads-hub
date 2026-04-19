"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/client";
import { requireAuth } from "@/lib/auth/session";
import {
  assertValidSlug,
  countWords,
  estimateReadingTimeSec,
  type ArticleStatus,
} from "@/lib/articles/types";
import { replaceAffiliateUrlsInMarkdown } from "@/lib/short-links";

export interface UpsertArticleInput {
  id?: string;
  account_id: string;
  slug: string;
  title: string;
  subtitle?: string;
  body_md: string;
  cover_image_url?: string | null;
  og_image_url?: string | null;
  seo?: {
    description?: string;
    keywords?: string[];
    canonical_url?: string;
  };
}

export async function upsertArticle(input: UpsertArticleInput): Promise<{ id: string }> {
  await requireAuth();
  assertValidSlug(input.slug);
  if (!input.title.trim()) throw new Error("title is required");
  if (!input.account_id) throw new Error("account_id is required");

  const supabase = createServiceClient();

  const word_count = countWords(input.body_md);
  const reading_time_sec = estimateReadingTimeSec(input.body_md);

  const payload = {
    account_id: input.account_id,
    slug: input.slug,
    title: input.title,
    subtitle: input.subtitle ?? null,
    body_md: input.body_md,
    cover_image_url: input.cover_image_url ?? null,
    og_image_url: input.og_image_url ?? null,
    seo: input.seo ?? {},
    word_count,
    reading_time_sec,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    // 既存記事の編集履歴を先に保存（更新前の状態）
    const { data: existing } = await supabase
      .from("articles")
      .select("id, title, body_md, version")
      .eq("id", input.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("article_revisions").insert({
        article_id: existing.id,
        version: existing.version,
        title: existing.title,
        body_md: existing.body_md,
        saved_by: "admin",
      });

      const { error } = await supabase
        .from("articles")
        .update({ ...payload, version: existing.version + 1 })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return { id: input.id };
    }
  }

  const { data, error } = await supabase
    .from("articles")
    .insert({ ...payload, created_by: "admin" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function transitionArticleStatus(id: string, nextStatus: ArticleStatus, reviewNotes?: string) {
  await requireAuth();
  const supabase = createServiceClient();

  // 公開時: A8等のURLを短縮URLに置換、cta_destinations を自動作成
  if (nextStatus === "published") {
    const { data: current } = await supabase
      .from("articles")
      .select("id, account_id, slug, title, body_md, accounts(slug)")
      .eq("id", id)
      .maybeSingle();
    if (current) {
      const accSlug = Array.isArray((current as any).accounts)
        ? (current as any).accounts[0]?.slug
        : (current as any).accounts?.slug;

      // A8 等の裸URLを /go/{slug} にラップ
      const rewrittenBody = await replaceAffiliateUrlsInMarkdown({
        markdown: current.body_md ?? "",
        accountId: current.account_id,
        articleId: current.id,
      });
      if (rewrittenBody !== (current.body_md ?? "")) {
        await supabase.from("articles").update({ body_md: rewrittenBody }).eq("id", id);
      }

      // cta_destinations に internal_article 行を upsert
      if (accSlug) {
        const publicUrl = `https://note-sub.top/${accSlug}/${current.slug}`;
        const { data: existing } = await supabase
          .from("cta_destinations")
          .select("id")
          .eq("account_id", current.account_id)
          .eq("article_id", id)
          .maybeSingle();
        if (existing?.id) {
          await supabase
            .from("cta_destinations")
            .update({ url: publicUrl, name: current.title, is_active: true })
            .eq("id", existing.id);
        } else {
          await supabase.from("cta_destinations").insert({
            account_id: current.account_id,
            article_id: id,
            cta_type: "internal_article",
            name: current.title,
            url: publicUrl,
            description: `内製CMS記事: ${current.title}`,
            is_active: true,
            priority: 5,
          });
        }
      }
    }
  }

  const update: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };

  if (nextStatus === "published") {
    update.published_at = new Date().toISOString();
  }

  if (nextStatus === "draft" && reviewNotes) {
    update.review_notes = reviewNotes;
  }

  const { error } = await supabase.from("articles").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  // アーカイブ・下書き戻しの場合、紐付いた cta_destinations を非活性化
  if (nextStatus === "archived" || nextStatus === "draft") {
    await supabase
      .from("cta_destinations")
      .update({ is_active: false })
      .eq("article_id", id);
  }

  revalidatePath("/articles");
  // 公開ページの ISR も更新
  const { data: art } = await supabase
    .from("articles")
    .select("slug, accounts(slug)")
    .eq("id", id)
    .maybeSingle();
  if (art) {
    const accSlug = Array.isArray((art as any).accounts) ? (art as any).accounts[0]?.slug : (art as any).accounts?.slug;
    if (accSlug) revalidatePath(`/${accSlug}/${art.slug}`);
  }
  revalidatePath("/sitemap.xml");
}

export async function deleteArticle(id: string) {
  await requireAuth();
  const supabase = createServiceClient();
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/articles");
  redirect("/articles");
}
