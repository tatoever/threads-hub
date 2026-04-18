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
  COMMON_OUTPUT_RULE,
} from "./common-base";
import { getJstTimeContext, formatCommentReceivedTime } from "./time-context";

export interface PersonaRow {
  display_name: string;
  tone_style: string | null;
  age_range: string | null;
  gender_feel: string | null;
  background: string | null;
  prohibited_words: string[] | null;
  reply_rules: ReplyRules | null;
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

  return [
    `あなたは「${persona.display_name}」として、Threads コメントに返信します。`,
    "",
    personaBlock,
    personaReplyRulesBlock,
    firstPersonBlock,
    signatureBlock,
    COMMON_PEER_REGISTER,
    COMMON_BELIEFS,
    COMMON_STRUCTURE,
    COMMON_CONTEXT_LINK,
    COMMON_TIME_RULES,
    COMMON_NG,
    COMMON_OUTPUT_RULE,
  ].filter(Boolean).join("\n\n");
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

export interface UserPromptInput {
  postContent: string | null;
  commentContent: string;
  commentAuthorUsername: string | null;
  commentCreatedAt: string; // ISO
  avoidOpenings: string[];
  regenerationFeedback?: string; // 品質チェック後のリジェネ時のみ
}

export function buildUserPrompt(input: UserPromptInput): string {
  const time = getJstTimeContext();
  const commentTime = formatCommentReceivedTime(input.commentCreatedAt);
  const postSnippet = (input.postContent || "（元投稿不明）").slice(0, 500);
  const author = input.commentAuthorUsername ? `@${input.commentAuthorUsername}` : "コメンター";

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
    `【現在時刻】${time.nowJstIso}（時間帯: ${time.timeBand}）`,
    `【コメント受信時刻】${commentTime}`,
    "",
    `【元投稿（文脈として使用）】`,
    postSnippet,
    "",
    `【コメント（これに返信する）】`,
    `${author}: ${input.commentContent}`,
    "",
    avoidBlock,
    regenBlock,
    "",
    `上記を踏まえ、キャラクターに沿った返信を1つだけ生成してください。40〜80字推奨、100字絶対超えない。返信テキスト本文のみ出力。`,
  ].filter(Boolean).join("\n");
}
