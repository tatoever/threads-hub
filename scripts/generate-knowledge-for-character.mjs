// 残り9キャラの3JSONBをClaude Opus CLIで自動生成するスクリプト
//
// 使い方:
//   node --env-file=.env.local scripts/generate-knowledge-for-character.mjs kojika-miku
//   node --env-file=.env.local scripts/generate-knowledge-for-character.mjs --all
//
// 前提:
//   - 龍之介 (ryunosuke_knowledge_layers.json) がテンプレとして存在
//   - Claude CLI が使える状態（サブスクまたはAPI key）
//   - account_personas に基本情報（niche, tone_style, background等）が入っている

import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const KNOWLEDGE_DIR = "C:/Users/X99-F8/iCloudDrive/_AIエージェント";
const TEMPLATE_FILE = path.join(KNOWLEDGE_DIR, "ryunosuke_knowledge_layers.json");

const SLUGS_ALL = [
  "kojika-miku",
  "fukurou-sensei",
  "hodokeru-kapibara",
  "shiro-usagi-sama",
  "kijitora-sensei",
  "shibainu-senpai",
  "tsukiyo-yamaneko",
  "kawauso-kaasan",
  "alpaca-sensei",
];

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node generate-knowledge-for-character.mjs <slug> | --all");
  process.exit(1);
}

const targets = arg === "--all" ? SLUGS_ALL : [arg];

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const template = JSON.parse(fs.readFileSync(TEMPLATE_FILE, "utf-8"));

function callClaude(prompt, systemPrompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["-p", "--model", "opus", "--system-prompt", systemPrompt], {
      shell: true,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "", stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`exit ${code}: ${stderr}`));
      else resolve(stdout.trim());
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

for (const slug of targets) {
  console.log(`\n=== ${slug} の3JSONB生成開始 ===`);

  const { data: acc } = await s.from("accounts").select("id, name, slug").eq("slug", slug).single();
  if (!acc) { console.error(`  account not found: ${slug}`); continue; }

  const { data: persona } = await s.from("account_personas").select("*").eq("account_id", acc.id).single();
  if (!persona) { console.error(`  persona not found: ${slug}`); continue; }

  const systemPrompt = `あなたは Threads マルチアカウント運用戦略家です。与えられたキャラクター情報とテンプレート構造に基づき、そのキャラ専用の知識レイヤー3種（growth_principles_adapted / fan_marketing_stance / post_type_materials）を JSON で生成します。

重要制約:
- 必ず JSON だけを出力（前後の説明文や \`\`\`json 等は不要、素の JSON オブジェクトのみ）
- テンプレと同じ構造・キー名を厳守
- 各配列は例と同じ件数（5-7個）を埋める
- キャラクターの口調・世界観・ターゲットに合わせて具体化すること
- 『抽象ルール』ではなく『そのキャラが実際に言いそうな具体フレーズ』を書く
- AI臭いテンプレ語禁止（『素敵』『パワフル』『皆さん』等）`;

  const userPrompt = `## ターゲットキャラクター
- name: ${acc.name}
- slug: ${acc.slug}
- display_name: ${persona.display_name}
- genre: ${persona.genre}
- niche: ${persona.niche}
- target_audience: ${persona.target_audience}
- value_proposition: ${persona.value_proposition}
- tone_style: ${persona.tone_style}
- age_range: ${persona.age_range}
- gender_feel: ${persona.gender_feel}
- background: ${persona.background}
- prohibited_words: ${JSON.stringify(persona.prohibited_words || [])}

## テンプレート構造（龍之介キャラの完成版。構造のみ参考にし、中身はターゲットキャラに合わせて書き換えること）

\`\`\`json
${JSON.stringify(
  {
    growth_principles_adapted: template.growth_principles_adapted,
    fan_marketing_stance: template.fan_marketing_stance,
    post_type_materials: template.post_type_materials,
    profile_tagline: template.profile_tagline,
  },
  null,
  2
)}
\`\`\`

上記テンプレと同じ構造で、ターゲットキャラクター（${acc.name}）用の JSON を生成せよ。`;

  try {
    console.log(`  Claude Opus 呼び出し中...`);
    const out = await callClaude(userPrompt, systemPrompt);

    // JSON 抽出（フェンスがあれば除去）
    let jsonStr = out;
    const fence = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fence) jsonStr = fence[1];

    const generated = JSON.parse(jsonStr);

    const outFile = path.join(KNOWLEDGE_DIR, `${slug.replace(/-/g, "_")}_knowledge_layers.json`);
    const fullDoc = {
      slug,
      name: acc.name,
      character_profile: {
        niche: persona.niche,
        tone: persona.tone_style,
        background: persona.background,
      },
      ...generated,
    };
    fs.writeFileSync(outFile, JSON.stringify(fullDoc, null, 2), "utf-8");
    console.log(`  ✅ ${outFile} 保存完了`);

    // DB書き込み
    await s.from("account_personas").update({
      growth_principles_adapted: generated.growth_principles_adapted,
      fan_marketing_stance: generated.fan_marketing_stance,
      post_type_materials: generated.post_type_materials,
    }).eq("account_id", acc.id);

    if (generated.profile_tagline) {
      await s.from("accounts").update({ profile_tagline: generated.profile_tagline }).eq("id", acc.id);
    }

    console.log(`  ✅ DB書き込み完了`);
  } catch (e) {
    console.error(`  ❌ ${slug} 生成失敗: ${e.message}`);
  }

  // レート制限避けるため5秒待機
  await new Promise((r) => setTimeout(r, 5000));
}

console.log("\n=== 完了 ===");
