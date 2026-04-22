/**
 * Phase 5: Generate - 投稿生成（投稿時刻の30-60分前に1本ずつ）
 *
 * meetingのdaily_content_planから該当スロットを取得し、
 * ペルソナに基づいてCoT生成→品質チェック→保存。
 */

import { supabase } from "../utils/supabase";
import { callClaude, callClaudeJson, type ModelType } from "../utils/claude-cli";
import { getJstDayContext, buildDayConstraintBlock } from "../utils/day-context";
import { buildFamilyCanonBlock, detectForbiddenVocab, type FamilyCanon } from "../utils/family-canon";
import type { TaskData } from "../task-executor";

export async function runGenerate(task: TaskData): Promise<Record<string, any>> {
  const { account_id, payload } = task;
  const date = payload.date || new Date().toISOString().split("T")[0];
  const slotNumber = payload.slot_number;
  const model: ModelType = (task.model as ModelType) || "opus";

  // 1. Load meeting plan
  const { data: meetingRun } = await supabase
    .from("pipeline_runs")
    .select("output_data")
    .eq("account_id", account_id)
    .eq("date", date)
    .eq("phase", "meeting")
    .eq("status", "completed")
    .single();

  if (!meetingRun?.output_data) {
    throw new Error("Meeting plan not found. Run meeting phase first.");
  }

  const contentPlan = meetingRun.output_data as any;
  const slot = contentPlan.slots?.find((s: any) => s.slot_number === slotNumber);

  if (!slot) {
    throw new Error(`Slot ${slotNumber} not found in content plan`);
  }

  // 2. Load persona + prompts
  const { data: persona } = await supabase
    .from("account_personas")
    .select("*")
    .eq("account_id", account_id)
    .single();

  const { data: genPrompt } = await supabase
    .from("account_prompts")
    .select("system_prompt")
    .eq("account_id", account_id)
    .eq("phase", "generate")
    .eq("is_active", true)
    .single();

  // 2b. Load buzz template if slot assigned one
  let buzzTemplate: any = null;
  if (slot.buzz_template_code) {
    const { data } = await supabase
      .from("buzz_templates")
      .select("*")
      .eq("code", slot.buzz_template_code)
      .eq("is_active", true)
      .maybeSingle();
    buzzTemplate = data || null;
  }

  // 2c. Validate slot.cta against actual cta_destinations (gate layer 1)
  // Opus may generate slot.cta referencing a destination that doesn't exist.
  if (slot.cta?.destination_name) {
    const { data: ctaExists } = await supabase
      .from("cta_destinations")
      .select("id,cta_type,url")
      .eq("account_id", account_id)
      .eq("name", slot.cta.destination_name)
      .eq("is_active", true)
      .maybeSingle();
    if (!ctaExists) {
      console.warn(
        `[generate] slot.cta "${slot.cta.destination_name}" not registered for account, dropping`
      );
      slot.cta = null;
    }
  }

  // 2d. Enforce CTA-exclusive templates (gate layer 3)
  // Only cta_drive type can carry slot.cta. Meeting phase may accidentally
  // assign cta to non-cta_drive slots; strip them.
  if (slot.cta && slot.buzz_template_code !== "cta_drive") {
    console.warn(
      `[generate] slot ${slotNumber} has cta but buzz_template_code=${slot.buzz_template_code} (not cta_drive), dropping cta`
    );
    slot.cta = null;
  }

  // 3. Generate post content (main + optional reply_1 + reply_2 as tree)
  const systemPrompt = genPrompt?.system_prompt || buildDefaultSystemPrompt(persona);
  const userPrompt = buildGeneratePrompt(slot, contentPlan.narrative_thread, persona, buzzTemplate, date);

  const { data: generated } = await callClaudeJson<{ main: string; reply_1?: string | null; reply_2?: string | null }>(
    userPrompt,
    {
      model,
      systemPrompt,
      timeoutMs: 120_000,
    }
  );

  // 4. Extract content
  let postContent = sanitizeContent(generated.main || "", 200);
  let reply1: string | null = generated.reply_1 ? sanitizeContent(generated.reply_1, 200) : null;
  let reply2: string | null = generated.reply_2 ? sanitizeContent(generated.reply_2, 200) : null;

  // 5. Quality check on main
  const qualityResult = await runQualityCheck(postContent, persona, date);

  if (!qualityResult.passed) {
    // Auto-fix attempt on main only
    const fixPrompt = `以下の投稿本文を修正してください。問題点: ${qualityResult.issues.join(", ")}

元の投稿:
${postContent}

修正後の本文のみを出力してください（200文字以内）。`;

    const fixResult = await callClaude(fixPrompt, { model, systemPrompt });
    postContent = sanitizeContent(extractPostContent(fixResult.text), 200);
  }

  // 5b. Sanitize unsolicited CTA (gate layer 2)
  // Opus sometimes injects "note に" / "プロフから" even when slot.cta is null.
  // If CTA is not explicitly configured, strip CTA-like replies.
  const hasCtaConfig = slot.cta && slot.cta.method === "reply_tree";
  if (!hasCtaConfig) {
    if (reply1 && looksLikeUnsolicitedCta(reply1)) {
      console.warn(`[generate] stripped reply_1 (unsolicited CTA-like): ${reply1.slice(0, 50)}`);
      reply1 = null;
    }
    if (reply2 && looksLikeUnsolicitedCta(reply2)) {
      console.warn(`[generate] stripped reply_2 (unsolicited CTA-like): ${reply2.slice(0, 50)}`);
      reply2 = null;
    }
    // If reply_1 was stripped but reply_2 still has content, promote it
    if (!reply1 && reply2) {
      reply1 = reply2;
      reply2 = null;
    }
  }

  // 6. Place CTA in the last empty reply slot (if slot.cta exists)
  if (hasCtaConfig) {
    // cta_drive 型: Opus 生成 reply_2 のあとに URL のみ自動付与
    // （行動喚起文はテンプレの指示で reply_2 内に既に含まれている）
    if (slot.buzz_template_code === "cta_drive") {
      const { data: dest } = await supabase
        .from("cta_destinations")
        .select("url")
        .eq("account_id", account_id)
        .eq("name", slot.cta.destination_name)
        .eq("is_active", true)
        .maybeSingle();
      if (dest?.url) {
        // URL を reply_2 末尾に付与（なければ reply_1 に）
        if (reply2) {
          reply2 = (reply2 + "\n\n" + dest.url).slice(0, 220);
        } else if (reply1) {
          reply1 = (reply1 + "\n\n" + dest.url).slice(0, 220);
        }
      }
    } else {
      // 汎用 CTA（cta_drive 以外）は cta_text を使う従来方式
      if (!reply1) reply1 = slot.cta.cta_text;
      else if (!reply2) reply2 = slot.cta.cta_text;
      else reply2 = (reply2 + "\n\n" + slot.cta.cta_text).slice(0, 200);
    }
  }

  // 7. Calculate scheduled_at with deterministic minute-level jitter
  // meeting.ts の出力（07:00, 08:30 等キリのいい時刻）に ±10分の分散を加える
  // 同じ date+account_id+slot_number なら常に同じオフセットになる（再現性のため）
  const baseTime = slot.scheduled_time; // "HH:MM"
  const [hh, mm] = baseTime.split(":").map(Number);
  const seed = `${date}-${account_id}-${slotNumber}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  const jitterMin = (Math.abs(hash) % 21) - 10; // -10 to +10
  const totalMin = hh * 60 + mm + jitterMin;
  const newHh = ((Math.floor(totalMin / 60) % 24) + 24) % 24;
  const newMm = ((totalMin % 60) + 60) % 60;
  const jitteredTime = `${String(newHh).padStart(2, "0")}:${String(newMm).padStart(2, "0")}`;
  const scheduledAt = `${date}T${jitteredTime}:00+09:00`; // JST
  console.log(`[generate] slot ${slotNumber} time: ${baseTime} → ${jitteredTime} (jitter ${jitterMin}min)`);

  // 8. Save post
  const { data: savedPost, error: saveError } = await supabase
    .from("posts")
    .insert({
      account_id,
      content: postContent,
      status: "approved",
      slot_number: slotNumber,
      scheduled_at: scheduledAt,
      template_type: slot.category,
      category: slot.category,
      strategy_instructions: slot,
      reply_1: reply1,
      reply_2: reply2,
    })
    .select()
    .single();

  if (saveError) {
    throw new Error(`Failed to save post: ${saveError.message}`);
  }

  // 9. Save CTA placement if applicable
  if (slot.cta && savedPost) {
    const { data: ctaDest } = await supabase
      .from("cta_destinations")
      .select("id")
      .eq("account_id", account_id)
      .eq("name", slot.cta.destination_name)
      .single();

    if (ctaDest) {
      await supabase.from("cta_placements").insert({
        account_id,
        post_id: savedPost.id,
        destination_id: ctaDest.id,
        placement_method: slot.cta.method,
        cta_text: slot.cta.cta_text,
      });

      // Increment counter
      // Increment placement counter
      await supabase
        .from("cta_destinations")
        .update({ total_placements: ((ctaDest as any).total_placements || 0) + 1 })
        .eq("id", ctaDest.id);
    }
  }

  return {
    status: "completed",
    post_id: savedPost?.id,
    slot_number: slotNumber,
    content_length: postContent.length,
    has_cta: !!slot.cta,
  };
}

function buildDefaultSystemPrompt(persona: any): string {
  const prohibitedWords = persona?.prohibited_words || [];

  return `あなたは「${persona?.display_name || "投稿者"}」としてThreadsに投稿するコンテンツを作成します。

キャラクター:
- 口調: ${persona?.tone_style || "カジュアル"}
- 年齢感: ${persona?.age_range || "不明"}
- 性別感: ${persona?.gender_feel || "不明"}
- 背景: ${persona?.background || "なし"}

ルール:
- main 本文は200文字以内（長くなる場合は reply_1/reply_2 にツリー分割）
- 禁止ワード: ${prohibitedWords.join(", ") || "なし"}
- AI臭い表現を避ける（emダッシュ、三点リーダの多用、「...」、定型的な締めくくり）
- JSON形式で出力（main / reply_1 / reply_2）`;
}

function buildGeneratePrompt(
  slot: any,
  narrativeThread: string,
  persona: any,
  buzzTemplate: any = null,
  date?: string
): string {
  const hasCta = slot.cta && slot.cta.method === "reply_tree";
  const dayCtx = getJstDayContext(date);
  const dayConstraintBlock = buildDayConstraintBlock(dayCtx);
  const familyCanonBlock = buildFamilyCanonBlock(persona?.family_canon as FamilyCanon, date);

  // バズ構文テンプレ指定があればそちらを優先、なければ従来のスロット指示
  const templateSection = buzzTemplate
    ? `## バズ構文テンプレ: 【${buzzTemplate.name}】 (code=${buzzTemplate.code})
${buzzTemplate.prompt_body}

（※このテンプレの構造・リズムを踏襲してください。ただし例文の丸パクリは禁止。キャラの口調で独自に実装する）`
    : `## スロット指示（汎用）
- カテゴリ: ${slot.category || "-"}
- フック: ${slot.hook_type || "-"}`;

  return `# 投稿生成（Threadsネイティブ文化準拠）

${dayConstraintBlock}

${familyCanonBlock}

## 今日のストーリー軸
${narrativeThread}

## このスロットの主題
- テーマ: ${slot.theme || "-"}
- 内容指示: ${slot.content_directive || "-"}
- 感情入口: ${slot.emotional_target?.entry || "なし"}
- 感情出口: ${slot.emotional_target?.exit || "なし"}

${templateSection}

## 1行目フック絶対ルール（全型共通）
main の1行目で「読む/読まない」が決まる。以下6パターンのどれかで必ず書く:

A. **断言型**: 「もう、はっきり分かった」「これだけは言い切れる」
B. **宣言型**: 「全ての〇〇へ」「今から言うこと聞いて」
C. **実況型**: 「今〇〇しながら書いてる」「たった今〇〇した」「昨日の夜さ、」
D. **皮肉型**: 「〜ってことだよね、笑」「またかよって思うでしょ」
E. **叫び/数字型**: 「3日試したら」「30日続けた結果」「5分で変わった」など具体的数字 + 勢い
F. **対比型**: 「AよりB」で価値観を1行目でひっくり返す
  例: 「褒められるより、傷つけられないこと」「モテテクより、奪わない優しさ」

避けるべき1行目（NG）:
- 「〜について話します」「本日は〜」「今回は〜」（予告・前置き）
- 「〜のコツをお伝えします」（教科書調）
- 「いかがでしょうか」「ではないでしょうか」（AI臭）

## 数字の使い方（絶対ルール）
persona.background に明記されてない経歴系の数字は絶対に出さない。
- ✅ 使ってOK: 体験プロセス（3日、30日、5分、7個、5ステップ等）、一般時刻（朝5時、寝る前、電車で）、概数（およそ、だいたい）
- ❌ 使ってNG: 年齢（「26歳」「35歳」）、経験年数（「17年続けてきた」「10年見てきた」）、相談者数（「1000人見てきた」）
- persona.background に記載ない限り、架空の職歴・肩書き・経験は作らない

## 具体性要素（1行目 or main 内に必ず1つ）
- 数字（「3日」「7分」「5ステップ」）
- 固有名詞（「コンビニで」「ベランダで」「キッチンで」）※ただし上記の日付・曜日制約に違反する語彙は禁止
- シーン（「朝、布団の中で」「ソファで」）※平日／休日の区別を必ず守る
- 感情ワード（「ビビった」「震えた」「涙出た」「マジでやばい」）

## 失敗パターン回避（勝ちパターンDBより・絶対遵守）
- main と reply 系の末尾を「情報提示だけで終わらせない」。必ず問いかけ/軽い行動喚起/感情で締める
- 300字超の長文単発は途中離脱される → 200字超えそうなら必ずツリー分割
- 抽象的スピワード禁止。具体行動に必ず落とす
  ❌「波動を整える」→ ✅「朝の深呼吸3回」
  ❌「宇宙のエネルギーを感じる」→ ✅「足裏に意識を向けて10秒」
  ❌「エネルギーが高い人」→ ✅「朝イチで一杯の水を飲む人」

## ツリー cliff-hanger パターン（ツリー使用時は必須）
main 末尾 or reply_1 末尾を以下のどれかで切る:
- 「〇〇のことか説明すると、」← 次で説明予告
- 「ただやっちゃダメなことがあって、」← 失敗予告
- 「実はこの前の続きで、」← 物語継続
- 「でもね、」「その続きはね、」← 王道の引き
- 「、、、」← 余韻で止める
ツリーに送るなら必ず cliff-hanger を入れる。完結させない。

## 文字数・ツリー構造ルール（絶対遵守）
- **main（本文）は 200 文字以内**
- 200文字で収まらない場合は **reply_1 / reply_2 にツリー分割**
- 各 reply も **200 文字以内**
- 短く言い切れるなら reply_1/reply_2 は null（無理に伸ばさない）
- 文の途中で切らず、段落/センテンス単位で自然に分ける
- ツリーに送るなら main 末尾で必ず **cliff-hanger**（「でもね、」「その特徴はね、」「、、、」等）

## CTA
${hasCta ? `- システム側で最後の reply に CTA を自動付与するため、出力 JSON には含めないこと` : "- CTA なし"}

## キャラ口調（persona を尊重）
- 口調/語尾/方言/一人称/口癖は persona.tone_style に従う: ${persona?.tone_style?.slice(0, 100) || "（指定なし）"}
- AI 臭い定型句は禁止: 「いかがでしょうか」「ではないでしょうか」「——」「...」「…」

## 出力形式（JSON）
追加説明・コードブロック・マークダウン不要。純粋なJSONのみ。
{
  "main": "本文（200文字以内、必須）",
  "reply_1": "続き1（200文字以内、不要なら null）",
  "reply_2": "続き2（200文字以内、不要なら null）"
}`;
}

function sanitizeContent(content: string, maxLen: number): string {
  let c = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
    .trim();
  if (c.length > maxLen) c = c.slice(0, maxLen);
  return c;
}

/**
 * Detect unsolicited CTA phrases Opus tends to insert even when told not to.
 * Safe: only called when slot.cta is null; short CTA-only replies are most likely
 * unsolicited.
 */
function looksLikeUnsolicitedCta(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  // URLs
  if (/https?:\/\//.test(t)) return true;
  if (/(?:note|t)\.com\//i.test(t)) return true;
  // CTA phrasings referencing external destinations
  const ctaKeywords = [
    /プロフ(?:から|のリンク|にある|のnote)/,
    /リンクは?プロフ/,
    /詳しくは.{0,10}(?:プロフ|リンク|note|続き)/,
    /続きは.{0,5}(?:プロフ|note|リンク)/,
    /note(?:に|で|を)(?:書|投稿|公開)/,
    /プロフ.{0,3}へ/,
    /\bnote\b.{0,20}(?:から|で|を)/i,
  ];
  if (ctaKeywords.some((p) => p.test(t))) return true;
  return false;
}

function extractPostContent(text: string): string {
  // Remove markdown fences, thinking tags, etc.
  let content = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
    .replace(/^(投稿本文|出力|以下が|---).*/gm, "")
    .trim();

  // Truncate to 500 chars (Threads limit)
  if (content.length > 500) {
    content = content.slice(0, 497) + "...";
  }

  return content;
}

async function runQualityCheck(
  content: string,
  persona: any,
  date?: string
): Promise<{ passed: boolean; issues: string[] }> {
  const issues: string[] = [];

  // Length check（main のみ。200文字以内）
  if (content.length > 200) {
    issues.push("200文字超過（main）");
  }
  if (content.length < 30) {
    issues.push("短すぎる（30文字未満）");
  }

  // Prohibited words check
  const prohibitedWords = persona?.prohibited_words || [];
  for (const word of prohibitedWords) {
    if (content.includes(word)) {
      issues.push(`禁止ワード「${word}」を含む`);
    }
  }

  // Family canon vocab guard（年齢不一致語彙の検知）
  const forbiddenFamilyVocab = detectForbiddenVocab(content, persona?.family_canon as FamilyCanon, date);
  for (const word of forbiddenFamilyVocab) {
    issues.push(`家族canon違反: 「${word}」は今日時点の家族年齢と矛盾`);
  }

  // AI smell check (basic)
  const aiSmellPatterns = [
    /——/g,     // em dash
    /\.{3,}/g,  // triple dots
    /…{2,}/g,   // multiple ellipsis
    /いかがでしょうか/g,
    /ではないでしょうか/g,
  ];

  for (const pattern of aiSmellPatterns) {
    if (pattern.test(content)) {
      issues.push(`AI臭パターン検出: ${pattern.source}`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
