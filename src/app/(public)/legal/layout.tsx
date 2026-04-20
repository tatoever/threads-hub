import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal-wrap">
      <header className="legal-header">
        <Link href="/" className="legal-site-link">
          note-sub.top
        </Link>
      </header>
      <main className="legal-main">{children}</main>
      <footer className="legal-footer">
        <nav className="legal-footer-nav">
          <Link href="/legal/privacy">プライバシーポリシー</Link>
          <Link href="/legal/tokushoho">運営者情報</Link>
          <Link href="/legal/advertising">広告表示について</Link>
          <Link href="/legal/character">運営キャラクターについて</Link>
        </nav>
        <p className="legal-copy">© {new Date().getFullYear()} note-sub.top</p>
      </footer>
    </div>
  );
}
