export type ArticleStatus = "draft" | "pending_review" | "published" | "archived";

export interface Article {
  id: string;
  account_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  body_md: string;
  body_html: string | null;
  cover_image_url: string | null;
  og_image_url: string | null;
  status: ArticleStatus;
  published_at: string | null;
  scheduled_at: string | null;
  word_count: number | null;
  reading_time_sec: number | null;
  seo: {
    description?: string;
    keywords?: string[];
    canonical_url?: string;
  };
  affiliate_blocks: unknown[];
  metrics_cache: Record<string, unknown>;
  pipeline_run_id: string | null;
  created_by: string | null;
  review_notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ArticleListItem
  extends Pick<
    Article,
    "id" | "account_id" | "slug" | "title" | "subtitle" | "status" | "published_at" | "updated_at" | "cover_image_url"
  > {}

export interface PublicArticleView {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  body_md: string;
  cover_image_url: string | null;
  og_image_url: string | null;
  published_at: string | null;
  reading_time_sec: number | null;
  seo: Article["seo"];
  account: {
    id: string;
    slug: string;
    name: string;
    display_name: string | null;
    background: string | null;
    genre: string | null;
    profile_picture_url: string | null;
    profile_bio: string | null;
  };
}

/** 記事の本文から読了時間（秒）を概算する。日本語は1分 = 400字で計算。 */
export function estimateReadingTimeSec(bodyMd: string): number {
  const plainText = bodyMd
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_`~\-]/g, "")
    .replace(/\s+/g, "");
  const charCount = plainText.length;
  const minutes = Math.max(1, Math.ceil(charCount / 400));
  return minutes * 60;
}

/** 単語数（日本語は文字数、英語はスペース区切り単語数の合算） */
export function countWords(bodyMd: string): number {
  const plainText = bodyMd
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_`~\-]/g, "");
  return plainText.replace(/\s+/g, "").length;
}

/** slug バリデーション: 英数小文字・ハイフン・アンダーバーのみ */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(slug) && slug.length >= 1 && slug.length <= 100;
}

export function assertValidSlug(slug: string): void {
  if (!isValidSlug(slug)) {
    throw new Error(
      `Invalid slug: "${slug}". Use lowercase letters, numbers, hyphens, underscores only (1-100 chars).`,
    );
  }
}

/**
 * note.com 風のランダム slug を生成する。
 * 形式: n + [a-z0-9]{12} (例: n1a734e59e205)
 * SEO目的ではなく識別子として使う
 */
export function generateRandomSlug(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "n";
  for (let i = 0; i < 12; i++) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}
