import Link from "next/link";
import { ArticleBody } from "./ArticleBody";
import type { PublicArticleView } from "@/lib/articles/types";
import { ReadingProgress } from "./ReadingProgress";
import { ArticleTracker } from "./ArticleTracker";

export function ArticleView({ article }: { article: PublicArticleView }) {
  const readingMin = article.reading_time_sec
    ? Math.ceil(article.reading_time_sec / 60)
    : null;

  const threadsHandle = article.account.threads_username || article.account.slug;
  const threadsUrl = `https://www.threads.net/@${threadsHandle}`;
  const displayName = article.account.display_name ?? article.account.name;
  const bio = article.account.profile_bio ?? article.account.background;

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
          <a
            href={threadsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="note-author"
          >
            <AccountAvatar
              src={article.account.profile_picture_url}
              name={displayName}
              className="note-author-avatar"
            />
            <span className="note-author-info">
              <span className="note-author-name">{displayName}</span>
              <span className="note-author-genre">@{threadsHandle}</span>
            </span>
          </a>
          {readingMin && (
            <div className="note-meta-right">
              <span className="note-reading">{readingMin}分で読めます</span>
            </div>
          )}
        </div>
      </div>

      <div className="note-body">
        <ArticleBody markdown={article.body_md} />
      </div>

      <footer className="note-footer">
        <a
          href={threadsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="note-author-card"
        >
          <AccountAvatar
            src={article.account.profile_picture_url}
            name={displayName}
            className="note-author-card-avatar"
            large
          />
          <div>
            <div className="note-author-card-name">{displayName}</div>
            <div className="note-author-card-handle">@{threadsHandle} · Threadsで見る →</div>
            {bio && <p className="note-author-card-bio">{bio}</p>}
          </div>
        </a>

        <div className="note-public-footer">
          <nav className="note-public-footer-nav">
            <Link href="/legal/privacy">プライバシーポリシー</Link>
            <Link href="/legal/tokushoho">運営者情報</Link>
            <Link href="/legal/advertising">広告表示について</Link>
          </nav>
          <p className="note-public-footer-copy">© {new Date().getFullYear()} note-sub.top</p>
        </div>
      </footer>
    </article>
  );
}

function AccountAvatar({
  src,
  name,
  className,
  large,
}: {
  src: string | null;
  name: string;
  className: string;
  large?: boolean;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={`${className} note-avatar-img`} />;
  }
  return (
    <span className={className} aria-hidden>
      {name.slice(0, 1)}
    </span>
  );
}
