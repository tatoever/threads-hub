import { ImageResponse } from "next/og";
import { getPublicArticle } from "@/lib/articles/queries";

export const runtime = "edge";
export const alt = "note article";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type PageParams = {
  accountSlug: string;
  articleSlug: string;
};

const ACCENT: Record<string, string> = {
  "ryunosuke-kun": "#d97706",
  "kawauso-kaasan": "#e67e22",
  "fukurou-sensei": "#1e3a8a",
};

export default async function OgImage({ params }: { params: PageParams }) {
  const { accountSlug, articleSlug } = params;
  const article = await getPublicArticle(accountSlug, articleSlug);

  const title = article?.title ?? "note-sub";
  const subtitle = article?.subtitle ?? "";
  const author = article?.account.display_name ?? article?.account.name ?? "note-sub";
  const accent = ACCENT[accountSlug] ?? "#1f2937";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: "#ffffff",
          padding: 60,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 12,
              height: 48,
              background: accent,
              borderRadius: 2,
            }}
          />
          <div style={{ fontSize: 22, color: "#64748b", fontWeight: 500 }}>note-sub.top</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: title.length > 30 ? 46 : 58,
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.35,
              letterSpacing: -0.5,
              marginBottom: 20,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 22,
                color: "#64748b",
                lineHeight: 1.5,
                maxWidth: 1000,
              }}
            >
              {subtitle.slice(0, 80)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {author.slice(0, 1)}
          </div>
          <div style={{ fontSize: 24, color: "#0f172a", fontWeight: 500 }}>{author}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
