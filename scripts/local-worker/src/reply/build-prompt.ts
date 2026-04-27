/**
 * コメント返信プロンプトビルダー
 *
 * 共通ベース（common-base.ts）× account_personas（persona + reply_rules）で
 * systemPrompt と userPrompt を組み立てる。
 */

import {
  COMMON_BELIEFS,
  COMMON_STRUCTURE,
  COMMON_NG,
  COMMON_PEER_REGISTER,
  COMMON_TIME_RULES,
  COMMON_CONTEXT_LINK,
  COMMON_TONE_SYNC,
  COMMON_OUTPUT_RULE,
} from "./common-base";
import { getJstTimeContext, formatCommentReceivedTime } from "./time-context";
import { buildDayConstraintBlock } from "../utils/day-context";
import { buildFamilyCanonBlock, type FamilyCanon } from "../utils/family-canon";

export interface PersonaRow {
  display_name: string;
  tone_style: string | null;
  age_range: string | null;
  gender_feel: string | null;
  background: string | null;
  prohibited_words: string[] | null;
  reply_rules: ReplyRules | null;
  family_canon?: FamilyCanon | null;
}

export interface ReplyRules {
  reply_focus?: "shared_experience_empathy" | "honne_affirmation" | "structured_interpretation";
  action_hint?: "soft_try" | "no_fix" | "gentle_insight";
  tone_color?: "hot" | "wet" | "calm";
  first_person_usage?: "minimal" | "normal";
  first_person_when_used?: string;
  first_person_strict?: boolean;
  speech_level?: "casual" | "polite_casual";
  signature_phrases?: string[];
  signature_usage?: "coloring_only" | "regular";
  auto_send?: boolean;
  // v2 (2026-04-22): 当事者ラベル占有。7アカ女性クラスターでの越境事故対策。
  // このアカが占有する当事者領域のキーワード。
  exclusive_label_keywords?: string[];
  // 他キャラが占有している領域のキーワード（返信で絶対に触れない）。
  forbidden_other_label_keywords?: string[];
  // v3 (2026-04-23): キャラ別返信スタイル微調整
  /** 「笑」の使用頻度: sometimes=相手に呼応/rare=基本使わない */
  laugh_usage?: "sometimes" | "rare";
  /** カジュアル相手への呼応レベル: polite_casual=丁寧半分残す/stay_polite=敬体維持 */
  casual_register_preference?: "polite_casual" | "stay_polite";
  /** 返信で自然に出るフレーズ例（相槌・共感の色付け、3-6個） */
  reply_example_phrases?: string[];
}

const REPLY_FOCUS_GUIDE: Record<NonNullable<ReplyRules["reply_focus"]>, string> = {
  shared_experience_empathy: `【返信フォーカス】shared_experience_empathy
- 「それわかる、同じだった」の自己開示型共感を軸にする
- 講釈しない（投稿で言い尽くしている）
- 最後に軽く背中を押す一言で締めることもある（action_hint 参照）`,
  honne_affirmation: `【返信フォーカス】honne_affirmation
- 弱音や本音を出してくれた事実を、まず肯定する
- 解決策の提示はしない。受け止めに徹する
- きれいごとで励まさない。「大丈夫」と安直に言わない`,
  structured_interpretation: `【返信フォーカス】structured_interpretation
- 相手の違和感や感覚に「名前」をつけて短く構造化する
- 解説は長くしない。40〜80字の中で「あー、なるほど」と思わせる余白を残す
- 感情への共感 + 一言の解釈を添える形`,
};

const ACTION_HINT_GUIDE: Record<NonNullable<ReplyRules["action_hint"]>, string> = {
  soft_try: "最後に軽く「やってみて」「試してみ」系で押してもいい。押し付けは禁止。毎回は入れない。",
  no_fix: "アクション提案・解決策提示は禁止。受け止めて終わる。",
  gentle_insight: "「〜の傾向だったりします」「〜のサインかも」のような柔らかい見解で締めることがある。断定しない。",
};

const TONE_COLOR_GUIDE: Record<NonNullable<ReplyRules["tone_color"]>, string> = {
  hot: "熱血体験談派。自分も通った道として寄り添う温度感。",
  wet: "しっとり本音派。共感の湿度が高い。受け止めに徹する。",
  calm: "知的落ち着き派。構造で捉える。温度は低めだが冷たくない。",
};

const SPEECH_LEVEL_GUIDE: Record<NonNullable<ReplyRules["speech_level"]>, string> = {
  casual: "タメ口ベース。「です」「ます」の丁寧語は原則使わない。",
  polite_casual: "「〜なんですよね」「〜だったりします」系の丁寧カジュアル。過度な敬語にしない。",
};

export function buildSystemPrompt(persona: PersonaRow): string {
  const rules = persona.reply_rules || {};
  const prohibitedExtra = (persona.prohibited_words || []).join(", ") || "なし";

  const personaBlock = `# キャラクター

- 表示名: ${persona.display_name}
- 口調: ${persona.tone_style || "（未設定）"}
- 年齢感: ${persona.age_range || "（未設定）"}
- 性別感: ${persona.gender_feel || "（未設定）"}
- 背景: ${persona.background || "（未設定）"}
- このアカウント固有の禁止語: ${prohibitedExtra}
`;

  const personaReplyRulesBlock = [
    `# 返信時の重点（キャラ固有）`,
    rules.reply_focus ? REPLY_FOCUS_GUIDE[rules.reply_focus] : "",
    rules.action_hint ? `【アクションヒント】${ACTION_HINT_GUIDE[rules.action_hint]}` : "",
    rules.tone_color ? `【温度感】${TONE_COLOR_GUIDE[rules.tone_color]}` : "",
    rules.speech_level ? `【語尾スタイル】${SPEECH_LEVEL_GUIDE[rules.speech_level]}` : "",
  ].filter(Boolean).join("\n\n");

  const firstPersonBlock = buildFirstPersonBlock(rules);
  const signatureBlock = buildSignatureBlock(rules);
  const identityLockBlock = buildIdentityLockBlock(rules);
  const laughBlock = buildLaughBlock(rules);
  const casualRegisterBlock = buildCasualRegisterBlock(rules);
  const replyExampleBlock = buildReplyExampleBlock(rules);
  const familyCanonBlock = buildFamilyCanonBlock(persona.family_canon);

  return [
    `あなたは「${persona.display_name}」として、Threads コメントに返信します。`,
    "",
    personaBlock,
    personaReplyRulesBlock,
    firstPersonBlock,
    signatureBlock,
    identityLockBlock,
    laughBlock,
    casualRegisterBlock,
    replyExampleBlock,
    familyCanonBlock,
    COMMON_PEER_REGISTER,
    COMMON_BELIEFS,
    COMMON_STRUCTURE,
    COMMON_CONTEXT_LINK,
    COMMON_TIME_RULES,
    COMMON_TONE_SYNC,
    COMMON_NG,
    COMMON_OUTPUT_RULE,
  ].filter(Boolean).join("\n\n");
}

/**
 * 当事者ラベルの占有を返信プロンプトに明示する。
 * v2 (2026-04-22): 7アカ女性クラスターでの越境事故対策。
 *   - 自分のラベル領域: コメント内容がそこを指す場合、ここの視点で返す
 *   - 他キャラ占有領域: コメントに出てきても、返信本文で経験語り/比喩/例示をしない
 */
function buildIdentityLockBlock(rules: ReplyRules): string {
  const mine = rules.exclusive_label_keywords || [];
  const forbidden = rules.forbidden_other_label_keywords || [];
  if (mine.length === 0 && forbidden.length === 0) return "";

  const lines: string[] = ["# identity_lock（当事者ラベルの占有）"];

  if (mine.length > 0) {
    lines.push("");
    lines.push("## あなたの当事者ラベル領域（この領域の視点で返信する）");
    for (const m of mine) lines.push(`- ${m}`);
  }

  if (forbidden.length > 0) {
    lines.push("");
    lines.push("## 他キャラが占有している領域（返信本文で触れない）");
    for (const f of forbidden) lines.push(`- ${f}`);
    lines.push("");
    lines.push("これらの領域のキーワード・自分の経験数字・体験談・比喩を返信に出さない。");
    lines.push("コメント内容にこれらが含まれていても、自分のラベル領域から見える角度だけで返す。");
    lines.push("例: コメンターがPMSの話をしてきても、shiroなら『繊細さが体調に出る日もあるよね』のように、自分の領域（HSP）の視点で受け止める。PMSそのものの経験談は書かない。");
  }

  return lines.join("\n");
}

function buildFirstPersonBlock(rules: ReplyRules): string {
  const usage = rules.first_person_usage || "minimal";
  const token = rules.first_person_when_used || "";
  const strict = rules.first_person_strict === true;

  const lines = [`# 一人称`, ""];
  if (usage === "minimal") {
    lines.push("返信では主語省略を基本にする。一人称は必要な時だけ、1返信あたり0〜1回まで。");
  } else {
    lines.push("一人称は普通に使って良い。ただし多用しない。");
  }
  if (token) {
    lines.push(`使う場合の一人称は「${token}」。`);
  }
  if (strict && token) {
    lines.push(`「${token}」以外の一人称（私／俺／僕／あたし 等）は絶対使わない。キャラ崩壊に直結する。`);
  }
  return lines.join("\n");
}

function buildSignatureBlock(rules: ReplyRules): string {
  const phrases = rules.signature_phrases || [];
  const usage = rules.signature_usage || "coloring_only";
  if (phrases.length === 0) return "";

  const header = "# よく使うフレーズ（色付けのみ）";
  const list = phrases.map((p) => `- ${p}`).join("\n");
  const rule =
    usage === "coloring_only"
      ? `※ これらは「色付け」であって骨格ではない。元投稿とコメントの文脈で自然に出るなら使う。無理に入れない。引っ張られて汎用的な返信にしない。`
      : `※ 自然に使う。毎回必ずではない。`;
  return [header, list, rule].join("\n");
}

/**
 * v3 (2026-04-23): 「笑」の使用頻度
 */
function buildLaughBlock(rules: ReplyRules): string {
  const usage = rules.laugh_usage ?? "sometimes";
  const guides = {
    sometimes:
      "相手が「笑/ｗ」を使っている時に、呼応として自然に入れてよい。自分から率先して使う必要はない。1返信1回まで。",
    rare:
      "「笑」は基本使わない。柔らかさは語尾と選語で出す。相手が「笑」を使っていても、自分は使わずに落ち着いた温度で返す。",
  } as const;
  return `# 「笑」の使い方\n${guides[usage]}`;
}

/**
 * v3 (2026-04-23): カジュアル相手への呼応レベル
 */
function buildCasualRegisterBlock(rules: ReplyRules): string {
  const pref = rules.casual_register_preference ?? "polite_casual";
  const guides = {
    polite_casual:
      "相手がタメ口や「笑」で話してきても、こちらは丁寧さを半分残す。「〜ですよね笑」「〜なんですよね」程度までは崩してよいが、完全タメ口（「それな」「〜じゃん」「〜だよね」単独）にはしない。",
    stay_polite:
      "相手がカジュアルでも敬体を維持する。笑・絵文字は使わず、「〜ですよ」「〜だと思いますよ」「〜かもしれません」で丁寧に返す。崩しすぎない温度を死守する。",
  } as const;
  return `# カジュアル相手への呼応レベル\n${guides[pref]}`;
}

/**
 * v3 (2026-04-23): 返信で自然に出るフレーズ例（相槌・共感の色付け）
 * signature_phrases（投稿本文での骨格語彙）とは別に、返信限定の「気軽な共感語彙」
 */
function buildReplyExampleBlock(rules: ReplyRules): string {
  const phrases = rules.reply_example_phrases ?? [];
  if (phrases.length === 0) return "";
  const header = "# 返信で自然に出るフレーズ例（相槌・共感の色付け）";
  const list = phrases.map((p) => `- 「${p}」`).join("\n");
  const rule =
    "※ これらは「気軽な共感・相槌」の色付けで、骨格ではない。返信の流れで自然に出るなら使う。無理に全フレーズを入れようとしない。1返信で最大1-2個まで。";
  return [header, list, rule].join("\n");
}

export interface UserPromptInput {
  postContent: string | null;
  commentContent: string;
  commentAuthorUsername: string | null;
  commentCreatedAt: string; // ISO
  avoidOpenings: string[];
  regenerationFeedback?: string; // 品質チェック後のリジェネ時のみ
}

/**
 * コメント本文から温度感（カジュアル/中間/フォーマル）を推測する
 * 外部 (reply.ts) からも使えるよう export
 */
export function inferToneHint(comment: string): { label: string; signals: string[] } {
  const signals: string[] = [];
  let casualScore = 0;
  let formalScore = 0;

  // カジュアル signal
  if (/笑|ｗ|w{2,}/.test(comment)) { signals.push("笑/ｗ"); casualScore += 2; }
  const exclamCount = (comment.match(/[！!]/g) || []).length;
  if (exclamCount >= 1) { signals.push(`！×${exclamCount}`); casualScore += 1; }
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(comment)) { signals.push("絵文字"); casualScore += 2; }
  if (/だよね|じゃん|だね|やん|やった|うれし/.test(comment)) { signals.push("タメ口語尾"); casualScore += 2; }
  if (comment.trim().length <= 10) { signals.push("極短"); casualScore += 1; }

  // フォーマル signal
  if (/ます[。？]|です[。？]|でしょうか|いただ|ございま/.test(comment)) { signals.push("です・ます丁寧"); formalScore += 2; }
  if (comment.length > 80 && !/[！!笑ｗ]|[\u{1F300}-\u{1FAFF}]/u.test(comment)) {
    signals.push("長文無記号"); formalScore += 1;
  }

  let label = "中間";
  if (casualScore >= 2 && casualScore > formalScore) label = "カジュアル";
  else if (formalScore >= 2 && formalScore > casualScore) label = "フォーマル";

  return { label, signals };
}

export function buildUserPrompt(input: UserPromptInput): string {
  const time = getJstTimeContext();
  const dayConstraintBlock = buildDayConstraintBlock(time.dayContext);
  const commentTime = formatCommentReceivedTime(input.commentCreatedAt);
  const postSnippet = (input.postContent || "（元投稿不明）").slice(0, 500);
  const author = input.commentAuthorUsername ? `@${input.commentAuthorUsername}` : "コメンター";

  const tone = inferToneHint(input.commentContent);
  const toneBlock = `【コメンターの温度感】${tone.label}${tone.signals.length > 0 ? `（検知: ${tone.signals.join("、")}）` : ""}
→ 自分の speech_level の枠内で、この温度感に合わせて微調整する（COMMON_TONE_SYNC 参照）。
→ ただし「笑」「絵文字」「語尾」を "メタに論評" しない。相手の書き方は受け取るだけ。`;

  const avoidBlock =
    input.avoidOpenings.length > 0
      ? `【避けるべき書き出し（直近の返信と被らない）】
${input.avoidOpenings.map((s) => `- 「${s}...」`).join("\n")}`
      : "";

  const regenBlock = input.regenerationFeedback
    ? `【前回生成の問題点（必ず修正すること）】
${input.regenerationFeedback}`
    : "";

  return [
    `【現在時刻】${time.nowJstIso}(${time.dayContext.dayOfWeekJa}、時間帯: ${time.timeBand})`,
    `【コメント受信時刻】${commentTime}`,
    "",
    dayConstraintBlock,
    "",
    `【元投稿（文脈として使用）】`,
    postSnippet,
    "",
    `【コメント（これに返信する）】`,
    `${author}: ${input.commentContent}`,
    "",
    toneBlock,
    "",
    avoidBlock,
    regenBlock,
    "",
    `上記を踏まえ、キャラクターに沿った返信を1つだけ生成してください。40〜80字推奨、100字絶対超えない。返信テキスト本文のみ出力。`,
  ].filter(Boolean).join("\n");
}
