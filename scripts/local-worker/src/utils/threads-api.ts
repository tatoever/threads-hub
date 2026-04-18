/**
 * Threads Graph API ラッパー（共通）
 *
 * 投稿・返信・コメント取得の低レベルAPIをまとめる。
 * publish.ts 等から参照。
 */

const GRAPH_BASE = "https://graph.threads.net/v1.0";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 投稿 or 返信をパブリッシュする（container 作成 → 2秒待機 → publish）
 * replyToId が渡された場合は返信として扱う。
 */
export async function publishToThreads(opts: {
  userId: string;
  accessToken: string;
  text: string;
  replyToId?: string;
}): Promise<{ id: string }> {
  const { userId, accessToken, text, replyToId } = opts;

  const createBody: Record<string, string> = {
    media_type: "TEXT",
    text,
    access_token: accessToken,
  };
  if (replyToId) createBody.reply_to_id = replyToId;

  const createRes = await fetch(`${GRAPH_BASE}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });
  if (!createRes.ok) {
    const err = await safeJson(createRes);
    throw new Error(`Threads container create failed (${createRes.status}): ${JSON.stringify(err).slice(0, 400)}`);
  }
  const { id: containerId } = await createRes.json();

  await sleep(2000);

  const publishRes = await fetch(`${GRAPH_BASE}/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });
  if (!publishRes.ok) {
    const err = await safeJson(publishRes);
    throw new Error(`Threads publish failed (${publishRes.status}): ${JSON.stringify(err).slice(0, 400)}`);
  }
  return publishRes.json();
}

/**
 * 特定の投稿に付いたコメント（conversation）を取得
 */
export interface ThreadsComment {
  id: string;
  text: string;
  username?: string;
  timestamp?: string;
}

export async function fetchConversation(opts: {
  mediaId: string;
  accessToken: string;
}): Promise<ThreadsComment[]> {
  const { mediaId, accessToken } = opts;
  const fields = "id,text,username,timestamp";
  const url = `${GRAPH_BASE}/${mediaId}/conversation?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(`fetchConversation failed (${res.status}): ${JSON.stringify(err).slice(0, 400)}`);
  }
  const json = await res.json();
  return (json?.data || []) as ThreadsComment[];
}

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return { _nonJson: true, status: res.status }; }
}
