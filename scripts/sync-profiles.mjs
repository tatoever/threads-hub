#!/usr/bin/env node
// One-shot: fetch Threads profile (picture + bio) for all accounts and update DB.
// Usage: node scripts/sync-profiles.mjs

import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !KEY) throw new Error("missing env");

const listRes = await fetch(
  `${SUPA}/rest/v1/accounts?select=id,name,threads_user_id,account_tokens(access_token,status)&order=created_at`,
  { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
);
const accounts = await listRes.json();

console.log(`Syncing profiles for ${accounts.length} accounts...\n`);

for (const a of accounts) {
  const t = Array.isArray(a.account_tokens) ? a.account_tokens[0] : a.account_tokens;
  if (!t?.access_token || t.status !== "active" || !a.threads_user_id) {
    console.log(`  SKIP   ${a.name} (no active token)`);
    continue;
  }

  const url = new URL(`https://graph.threads.net/v1.0/${a.threads_user_id}`);
  url.searchParams.set(
    "fields",
    "id,username,name,threads_profile_picture_url,threads_biography",
  );
  url.searchParams.set("access_token", t.access_token);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      console.log(`  FAIL   ${a.name}: ${res.status} ${body.slice(0, 140)}`);
      continue;
    }
    const p = await res.json();

    const patch = await fetch(`${SUPA}/rest/v1/accounts?id=eq.${a.id}`, {
      method: "PATCH",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        profile_picture_url: p.threads_profile_picture_url ?? null,
        profile_bio: p.threads_biography ?? null,
        profile_synced_at: new Date().toISOString(),
      }),
    });

    if (!patch.ok) {
      console.log(`  FAIL   ${a.name}: update ${patch.status}`);
      continue;
    }

    const pic = p.threads_profile_picture_url ? "🖼 " : "   ";
    const bioPrev = (p.threads_biography ?? "").slice(0, 32).replace(/\n/g, " ");
    console.log(`  OK ${pic}${a.name.padEnd(22)} bio="${bioPrev}${bioPrev.length === 32 ? "…" : ""}"`);
  } catch (e) {
    console.log(`  ERR    ${a.name}: ${e.message}`);
  }
}

console.log("\nDone.");
