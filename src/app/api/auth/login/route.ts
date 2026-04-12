import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}
