import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

export async function POST() {
  await requireAuth();

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "DISCORD_WEBHOOK_URL not set" }, { status: 400 });
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: "✅ **[threads-hub]** Discord通知テスト成功!",
    }),
  });

  return NextResponse.json({ ok: true });
}
