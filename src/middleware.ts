import { NextRequest, NextResponse } from "next/server";

/**
 * ホスト別のルーティング制御
 * - note-sub.top（公開ドメイン）: 記事公開ページとイベントAPIのみ許可、管理画面アクセスはnoteドメインへリダイレクト
 * - admin ドメイン（urasan-threads-auto-hub.vercel.app 等）: 従来の auth ガード
 */

const PUBLIC_DOMAIN = "note-sub.top";

// 管理ドメインで auth 不要のパス（常に公開）
const ADMIN_PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/threads/callback",
  "/api/cron",
  "/api/events/ingest",
  "/sitemap.xml",
  "/robots.txt",
  "/go",
  "/legal",
];

// 公開ドメイン（note-sub.top）で許可するパスのプレフィックス
const NOTE_ALLOWED_PREFIX = [
  "/api/events/ingest",
  "/sitemap.xml",
  "/robots.txt",
  "/favicon",
  "/_next",
  "/go/", // A8 等アフィリの短縮URLリダイレクタ
  "/legal/", // プラポリ・特商法・広告表示・キャラ開示
];

// 公開ドメイン（note-sub.top）で明確に不許可にするパス
const NOTE_DENY_PREFIX = [
  "/accounts",
  "/articles",
  "/pipeline",
  "/alerts",
  "/settings",
  "/buzz-templates",
  "/login",
  "/api/auth",
  "/api/cron",
  "/api/accounts",
  "/api/articles",
  "/api/buzz-templates",
  "/api/alerts",
  "/api/settings",
];

// admin ドメインで「公開記事URL」として扱わない第1セグメント
// これらは管理画面の通常ルート（/accounts/[id] 等）なのでリダイレクト対象外
const ADMIN_FIRST_SEGMENTS = new Set([
  "accounts",
  "articles",
  "pipeline",
  "alerts",
  "settings",
  "buzz-templates",
  "login",
  "api",
  "_next",
  "go", // 短縮URLリダイレクタ
  "legal", // 法務ページ
]);

function isPublicArticlePath(pathname: string): boolean {
  // "/{slug}/{slug}" の2セグメント構造（公開記事URL）
  const parts = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length !== 2) return false;
  if (ADMIN_FIRST_SEGMENTS.has(parts[0])) return false;
  // 第2セグメントは "n" + 英数字の note 風 slug を想定（UUID 等の admin ルート回避）
  if (!/^n[a-z0-9]{6,20}$/.test(parts[1]) && !/^[a-z0-9][a-z0-9_-]{2,}$/.test(parts[1])) return false;
  return /^[a-z0-9][a-z0-9_-]*$/.test(parts[0]);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") || "";
  const isPublicDomain = host === PUBLIC_DOMAIN || host === `www.${PUBLIC_DOMAIN}`;

  if (isPublicDomain) {
    // 公開ドメイン: 記事公開ページ + 必要な最小限のAPIのみ
    if (NOTE_ALLOWED_PREFIX.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    if (NOTE_DENY_PREFIX.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (pathname === "/") {
      // ルートアクセスは暫定的に 404（将来: ランディング / 全記事一覧）
      return NextResponse.rewrite(new URL("/_not-found", req.url));
    }
    if (isPublicArticlePath(pathname)) {
      return NextResponse.next();
    }
    // それ以外は 404
    return NextResponse.rewrite(new URL("/_not-found", req.url));
  }

  // 管理ドメインでの公開記事URL（2セグメント）は note-sub.top へ 301 リダイレクト
  // 誤って管理URLが外部に出ないようにする
  if (isPublicArticlePath(pathname)) {
    return NextResponse.redirect(`https://${PUBLIC_DOMAIN}${pathname}`, 301);
  }

  // 管理ドメイン側の処理
  if (ADMIN_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // セッション確認
  const session = req.cookies.get("threads-hub-session");
  if (!session?.value) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
