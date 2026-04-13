/**
 * Seed account_prompts from account-configs.json
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const supabase = createClient(
  "https://bllypchfvmovgokgjfsj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsbHlwY2hmdm1vdmdva2dqZnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjAyMDcxNiwiZXhwIjoyMDkxNTk2NzE2fQ.4-8aO4KoFY-nbKG7FpX_6kPDWPxTcDKpJB1u1V_Pg8s",
  { auth: { persistSession: false } }
);

const configs = JSON.parse(
  readFileSync("C:/Users/X99-F8/iCloudDrive/_AIエージェント/threads-multi-accounts/account-configs.json", "utf-8")
);

// JSON slug → DB slug mapping (where they differ)
const slugMap = {
  "fukurou-suuhi": "fukurou-sensei",
  "shiro-usagi-hsp": "shiro-usagi-sama",
  "kijitora-doku": "kijitora-sensei",
  "alpaca-okane": "alpaca-sensei",
  "ryunosuke-energy": "ryunosuke-kun",
};

async function seedPrompts() {
  console.log("=== Seeding prompts for 10 accounts ===\n");

  for (const config of configs.accounts) {
    const dbSlug = slugMap[config.slug] || config.slug;

    // Find account by slug
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("slug", dbSlug)
      .single();

    if (!account) {
      console.error(`Account not found: ${config.slug}`);
      continue;
    }

    // Delete existing prompts for this account
    await supabase
      .from("account_prompts")
      .delete()
      .eq("account_id", account.id);

    // Insert generate prompt
    const { error: genErr } = await supabase.from("account_prompts").insert({
      account_id: account.id,
      phase: "generate",
      prompt_name: "投稿生成プロンプト",
      system_prompt: config.generate_system_prompt,
      model_preference: "opus",
    });

    // Insert meeting prompt
    const { error: meetErr } = await supabase.from("account_prompts").insert({
      account_id: account.id,
      phase: "meeting",
      prompt_name: "会議プロンプト",
      system_prompt: config.meeting_system_prompt,
      model_preference: "opus",
    });

    console.log(
      `${config.slug}: generate=${genErr ? "ERR" : "OK"}, meeting=${meetErr ? "ERR" : "OK"}`
    );
  }

  console.log("\n=== Prompt seed complete ===");
}

seedPrompts().catch(console.error);
