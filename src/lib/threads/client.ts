const THREADS_API_BASE = "https://graph.threads.net/v1.0";

interface ThreadsCredentials {
  accessToken: string;
  userId: string;
}

// Publish a text post to Threads
export async function publishPost(
  credentials: ThreadsCredentials,
  text: string
): Promise<{ id: string }> {
  // Step 1: Create media container
  const createRes = await fetch(
    `${THREADS_API_BASE}/${credentials.userId}/threads`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "TEXT",
        text,
        access_token: credentials.accessToken,
      }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Threads create container failed: ${JSON.stringify(err)}`);
  }

  const { id: containerId } = await createRes.json();

  // Step 2: Publish the container
  const publishRes = await fetch(
    `${THREADS_API_BASE}/${credentials.userId}/threads_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: credentials.accessToken,
      }),
    }
  );

  if (!publishRes.ok) {
    const err = await publishRes.json();
    throw new Error(`Threads publish failed: ${JSON.stringify(err)}`);
  }

  return publishRes.json();
}

// Publish a reply to a post
export async function publishReply(
  credentials: ThreadsCredentials,
  replyToId: string,
  text: string
): Promise<{ id: string }> {
  const createRes = await fetch(
    `${THREADS_API_BASE}/${credentials.userId}/threads`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "TEXT",
        text,
        reply_to_id: replyToId,
        access_token: credentials.accessToken,
      }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Threads reply container failed: ${JSON.stringify(err)}`);
  }

  const { id: containerId } = await createRes.json();

  const publishRes = await fetch(
    `${THREADS_API_BASE}/${credentials.userId}/threads_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: credentials.accessToken,
      }),
    }
  );

  if (!publishRes.ok) {
    const err = await publishRes.json();
    throw new Error(`Threads reply publish failed: ${JSON.stringify(err)}`);
  }

  return publishRes.json();
}

// Get publishing rate limit
export async function getPublishingLimit(
  credentials: ThreadsCredentials
): Promise<{ quota_usage: number; config: { quota_total: number } }> {
  const res = await fetch(
    `${THREADS_API_BASE}/${credentials.userId}/threads_publishing_limit?fields=quota_usage,config&access_token=${credentials.accessToken}`
  );

  if (!res.ok) {
    throw new Error("Failed to get publishing limit");
  }

  const data = await res.json();
  return data.data[0];
}

// Get replies to a post
export async function getReplies(
  credentials: ThreadsCredentials,
  postId: string
): Promise<{ data: Array<{ id: string; text: string; username: string; timestamp: string }> }> {
  const res = await fetch(
    `${THREADS_API_BASE}/${postId}/replies?fields=id,text,username,timestamp&access_token=${credentials.accessToken}`
  );

  if (!res.ok) {
    throw new Error(`Failed to get replies: ${res.status}`);
  }

  return res.json();
}

// Get post insights
export async function getPostInsights(
  credentials: ThreadsCredentials,
  postId: string
): Promise<{ views: number; likes: number; replies: number; reposts: number }> {
  const res = await fetch(
    `${THREADS_API_BASE}/${postId}/insights?metric=views,likes,replies,reposts&access_token=${credentials.accessToken}`
  );

  if (!res.ok) {
    throw new Error(`Failed to get insights: ${res.status}`);
  }

  const data = await res.json();
  const metrics: Record<string, number> = {};
  for (const entry of data.data) {
    metrics[entry.name] = entry.values[0]?.value ?? 0;
  }

  return {
    views: metrics.views ?? 0,
    likes: metrics.likes ?? 0,
    replies: metrics.replies ?? 0,
    reposts: metrics.reposts ?? 0,
  };
}

// Exchange short-lived token for long-lived token
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(
    `${THREADS_API_BASE}/access_token?grant_type=th_exchange_token&client_secret=${process.env.THREADS_APP_SECRET}&access_token=${shortLivedToken}`
  );

  if (!res.ok) {
    throw new Error("Failed to exchange token");
  }

  return res.json();
}

// Refresh long-lived token
export async function refreshLongLivedToken(
  token: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(
    `${THREADS_API_BASE}/refresh_access_token?grant_type=th_refresh_token&access_token=${token}`
  );

  if (!res.ok) {
    throw new Error("Failed to refresh token");
  }

  return res.json();
}
