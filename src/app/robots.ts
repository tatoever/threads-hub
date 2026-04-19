import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/login", "/accounts/", "/articles/", "/pipeline/", "/alerts/", "/settings/", "/buzz-templates/"],
      },
    ],
    sitemap: "https://note-sub.top/sitemap.xml",
  };
}
