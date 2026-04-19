import { createServiceClient } from "@/lib/supabase/client";

const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // 紛らわしい文字（0,o,1,i,l）除外
const SLUG_LENGTH = 5;

export function generateShortSlug(length = SLUG_LENGTH): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return result;
}

/**
 * A8 等の外部URLを短縮URLでラップする。
 * 既に同一 target_url が存在すれば再利用、なければ新規発行。
 */
export async function getOrCreateShortLink(opts: {
  targetUrl: string;
  accountId?: string;
  articleId?: string;
  label?: string;
}): Promise<{ slug: string; url: string }> {
  const supabase = createServiceClient();

  // 既存の記事内で同じ target の短縮があれば再利用（article_id スコープで）
  if (opts.articleId) {
    const { data: existing } = await supabase
      .from("short_links")
      .select("slug")
      .eq("article_id", opts.articleId)
      .eq("target_url", opts.targetUrl)
      .maybeSingle();
    if (existing?.slug) {
      return { slug: existing.slug, url: `https://note-sub.top/go/${existing.slug}` };
    }
  }

  // 新規発行（slug 衝突時は再試行）
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = generateShortSlug(SLUG_LENGTH + Math.min(attempt, 3)); // 衝突続いたら桁数を増やす
    const { data, error } = await supabase
      .from("short_links")
      .insert({
        slug,
        target_url: opts.targetUrl,
        account_id: opts.accountId ?? null,
        article_id: opts.articleId ?? null,
        label: opts.label ?? null,
      })
      .select("slug")
      .single();
    if (!error && data) {
      return { slug: data.slug, url: `https://note-sub.top/go/${data.slug}` };
    }
    // unique violation なら次へ
    if (error && !/duplicate|unique|23505/i.test(error.message)) {
      throw new Error(`short_link creation failed: ${error.message}`);
    }
  }
  throw new Error("short_link slug collision exhausted retries");
}

/**
 * Markdown 本文から A8 / ココナラ系URLを検出して短縮URLに置換する。
 * publish 時に呼び出し、body_md を in-place 書き換え。
 */
const AFFILIATE_HOST_PATTERNS = [
  /px\.a8\.net\/svt\/ejp\?[^\s)'"]+/g,
  /a8\.net\/[^\s)'"]+/g,
  /coconala\.com\/services\/\d+\?ref=[^\s)'"]+/g,
];

export async function replaceAffiliateUrlsInMarkdown(opts: {
  markdown: string;
  accountId?: string;
  articleId?: string;
}): Promise<string> {
  let body = opts.markdown;
  // 既に note-sub.top/go/ になってるものは skip
  const seen = new Map<string, string>();

  for (const re of AFFILIATE_HOST_PATTERNS) {
    const matches = Array.from(body.matchAll(re));
    for (const m of matches) {
      const rawUrl = m[0];
      // 周囲が "go/" なら既にラップ済みとみなす（念のためのガード、通常ない）
      if (seen.has(rawUrl)) continue;
      const normalized = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
      const { url } = await getOrCreateShortLink({
        targetUrl: normalized,
        accountId: opts.accountId,
        articleId: opts.articleId,
        label: "a8-autolink",
      });
      seen.set(rawUrl, url);
    }
  }

  for (const [raw, shortUrl] of seen.entries()) {
    // replaceAll 相当（Node 15+）
    body = body.split(raw).join(shortUrl);
  }
  return body;
}
