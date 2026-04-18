/**
 * 直近の返信書き出しを取得して、プロンプトに「避けるべき書き出し」として渡す。
 * 金太郎飴防止。
 */

import { supabase } from "../utils/supabase";

export async function getRecentReplyOpenings(
  accountId: string,
  limit = 5,
  headChars = 15
): Promise<string[]> {
  const { data } = await supabase
    .from("comments")
    .select("reply_text, created_at")
    .eq("account_id", accountId)
    .not("reply_text", "is", null)
    .in("reply_status", ["approved", "sent"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!data) return [];
  return data
    .map((c) => (c.reply_text || "").slice(0, headChars).trim())
    .filter((s) => s.length > 0);
}
