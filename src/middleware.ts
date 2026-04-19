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
];

// 公開ドメイン（note-sub.top）で許可するパスのプレフィックス
const NOTE_ALLOWED_PREFIX = [
  "/api/events/ingest",
  "/sitemap.xml",
  "/robots.txt",
  "/favicon",
  "/_next",
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

function isPublicArticlePath(pathname: string): boolean {
  // "/{slug}/{slug}" の2セグメント構造（公開記事URL）
  const parts = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length !== 2) return false;
  return /^[a-z0-9][a-z0-9_-]*$/.test(parts[0]) && /^[a-z0-9][a-z0-9_-]*$/.test(parts[1]);
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
