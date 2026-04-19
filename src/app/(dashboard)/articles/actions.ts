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
