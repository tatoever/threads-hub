import Link from "next/link";
import { ArticleBody } from "./ArticleBody";
import type { PublicArticleView } from "@/lib/articles/types";
import { ReadingProgress } from "./ReadingProgress";
import { ArticleTracker } from "./ArticleTracker";

export function ArticleView({ article }: { article: PublicArticleView }) {
  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const readingMin = article.reading_time_sec
    ? Math.ceil(article.reading_time_sec / 60)
    : null;

  return (
    <article className="note-article">
      <ReadingProgress />
      <ArticleTracker articleId={article.id} accountId={article.account.id} />

      {article.cover_image_url && (
        <div className="note-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.cover_image_url} alt="" className="note-cover-img" />
        </div>
      )}

      <div className="note-header">
        <h1 className="note-title">{article.title}</h1>
        {article.subtitle && <p className="note-subtitle">{article.subtitle}</p>}

        <div className="note-meta">
          <Link href={`/${article.account.slug}`} className="note-author">
            <span className="note-author-avatar" aria-hidden>
              {(article.account.display_name ?? article.account.name).slice(0, 1)}
            </span>
            <span className="note-author-info">
              <span className="note-author-name">
                {article.account.display_name ?? article.account.name}
              </span>
              {article.account.genre && (
                <span className="note-author-genre">{article.account.genre}</span>
              )}
            </span>
          </Link>
          <div className="note-meta-right">
            {publishedDate && <span className="note-date">{publishedDate}</span>}
            {readingMin && <span className="note-reading">{readingMin}分で読めます</span>}
          </div>
        </div>
      </div>

      <div className="note-body">
        <ArticleBody markdown={article.body_md} />
      </div>

      <footer className="note-footer">
        {article.account.background && (
          <div className="note-author-card">
            <div className="note-author-card-avatar" aria-hidden>
              {(article.account.display_name ?? article.account.name).slice(0, 1)}
            </div>
            <div>
              <div className="note-author-card-name">
                {article.account.display_name ?? article.account.name}
              </div>
              <p className="note-author-card-bio">{article.account.background}</p>
            </div>
          </div>
        )}
      </footer>
    </article>
  );
}
