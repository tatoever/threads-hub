// 龍之介の3種JSONB（growth_principles_adapted / fan_marketing_stance / post_type_materials）
// を account_personas に書き込むスクリプト
//
// 前提: 003_character_knowledge_layers.sql マイグレーション適用済み
// 使い方: cd threads-hub && node --env-file=.env.local scripts/apply-knowledge-layers.mjs ryunosuke-kun

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const slug = process.argv[2] || "ryunosuke-kun";

const KNOWLEDGE_DIR = "C:/Users/X99-F8/iCloudDrive/_AIエージェント";
const fileMap = {
  "ryunosuke-kun": "ryunosuke_knowledge_layers.json",
};

const filename = fileMap[slug];
if (!filename) {
  console.error(`No knowledge file mapped for slug: ${slug}`);
  process.exit(1);
}

const filePath = path.join(KNOWLEDGE_DIR, filename);
const knowledge = JSON.parse(fs.readFileSync(filePath, "utf-8"));

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: account, error: accErr } = await s
  .from("accounts")
  .select("id, name")
  .eq("slug", slug)
  .single();

if (accErr) {
  console.error("Account lookup failed:", accErr.message);
  process.exit(1);
}

// account_personas 更新
const { data, error } = await s
  .from("account_personas")
  .update({
    growth_principles_adapted: knowledge.growth_principles_adapted,
    fan_marketing_stance: knowledge.fan_marketing_stance,
    post_type_materials: knowledge.post_type_materials,
  })
  .eq("account_id", account.id)
  .select();

if (error) {
  console.error("Update failed:", error.message);
  process.exit(1);
}

// accounts.profile_tagline も更新
if (knowledge.profile_tagline) {
  const { error: tagErr } = await s
    .from("accounts")
    .update({ profile_tagline: knowledge.profile_tagline })
    .eq("id", account.id);
  if (tagErr) console.warn("profile_tagline update warn:", tagErr.message);
}

console.log(`✅ ${account.name} (${slug}) 3JSONB + profile_tagline 書き込み完了`);
console.log(`   growth_principles: ${Object.keys(knowledge.growth_principles_adapted).length} keys`);
console.log(`   fan_marketing_stance: ${Object.keys(knowledge.fan_marketing_stance).length} keys`);
console.log(`   post_type_materials: ${Object.keys(knowledge.post_type_materials).length} keys`);
