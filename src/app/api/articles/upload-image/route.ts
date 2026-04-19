import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/client";
import { requireAuth } from "@/lib/auth/session";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const STORAGE_BUCKET = "article-images";

export async function POST(req: NextRequest) {
  await requireAuth();

  const form = await req.formData();
  const file = form.get("image");
  const accountId = form.get("account_id");
  const articleId = form.get("article_id");

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }
  if (typeof accountId !== "string") {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` }, { status: 400 });
  }

  const mime = (file as File).type || "image/jpeg";
  if (!mime.startsWith("image/")) {
    return NextResponse.json({ error: "not an image" }, { status: 400 });
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());

  // sharp で自動軽量化（original を WebP 90% + リサイズ2種）
  const sharpInput = sharp(originalBuffer, { failOn: "none" });
  const meta = await sharpInput.metadata();
  const origWidth = meta.width ?? 0;
  const origHeight = meta.height ?? 0;

  // WebP 生成: 元サイズ・1200px幅・800px幅
  const webpOriginal = await sharpInput.clone().webp({ quality: 88 }).toBuffer();
  const webp1200 = origWidth > 1200
    ? await sharpInput.clone().resize({ width: 1200 }).webp({ quality: 86 }).toBuffer()
    : webpOriginal;
  const webp800 = origWidth > 800
    ? await sharpInput.clone().resize({ width: 800 }).webp({ quality: 84 }).toBuffer()
    : webp1200;

  const timestamp = Date.now();
  const hash = crypto.randomUUID().slice(0, 8);
  const basePath = `${accountId}/${timestamp}-${hash}`;
  const origPath = `${basePath}/original.webp`;
  const p1200 = `${basePath}/w1200.webp`;
  const p800 = `${basePath}/w800.webp`;

  const supabase = createServiceClient();

  // アップロード3種
  const uploads = await Promise.all([
    supabase.storage.from(STORAGE_BUCKET).upload(origPath, webpOriginal, {
      contentType: "image/webp",
      upsert: false,
    }),
    supabase.storage.from(STORAGE_BUCKET).upload(p1200, webp1200, {
      contentType: "image/webp",
      upsert: false,
    }),
    supabase.storage.from(STORAGE_BUCKET).upload(p800, webp800, {
      contentType: "image/webp",
      upsert: false,
    }),
  ]);

  for (const u of uploads) {
    if (u.error) {
      return NextResponse.json(
        { error: `storage upload failed: ${u.error.message}` },
        { status: 500 },
      );
    }
  }

  // Public URL 取得（bucket を public にする前提）
  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(p1200);

  // DB に記録
  const { error: dbErr } = await supabase.from("article_images").insert({
    article_id: (typeof articleId === "string" && articleId) || null,
    account_id: accountId,
    original_path: origPath,
    webp_original_path: origPath,
    webp_1200_path: p1200,
    webp_800_path: p800,
    original_size_bytes: originalBuffer.length,
    compressed_size_bytes: webp1200.length,
    width: origWidth,
    height: origHeight,
    mime_type: mime,
  });

  if (dbErr) {
    return NextResponse.json({ error: `db insert failed: ${dbErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    url: pub.publicUrl,
    paths: { original: origPath, w1200: p1200, w800: p800 },
    sizes: { original: originalBuffer.length, compressed: webp1200.length },
  });
}
