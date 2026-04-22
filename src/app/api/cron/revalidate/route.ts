import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * CRON_SECRET 認証で任意の path を ISR revalidate する admin API。
 *
 * 用途: 直接 Supabase 更新で記事本文/メタを書き換えた後、
 *       next.js の static cache を明示的に再生成する（upsertArticle 経由せずに更新した時に必要）。
 *
 * 使い方:
 *   curl -X POST "https://urasan-threads-auto-hub.vercel.app/api/admin/revalidate" \
 *        -H "Authorization: Bearer $CRON_SECRET" \
 *        -H "Content-Type: application/json" \
 *        -d '{"paths":["/kawauso-kaasan/n1svhe46idb5z","/sitemap.xml"]}'
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { paths?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.paths) || body.paths.length === 0) {
    return NextResponse.json({ error: "paths[] required" }, { status: 400 });
  }

  const results: Record<string, string> = {};
  for (const p of body.paths) {
    try {
      revalidatePath(p);
      results[p] = "revalidated";
    } catch (e) {
      results[p] = "error: " + (e as Error).message;
    }
  }

  return NextResponse.json({ results });
}
