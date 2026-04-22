/**
 * 家族canon: 生年月日ベースで現時点の年齢・学齢を計算し、
 * 投稿生成・返信生成の prompt に動的注入する。
 *
 * 目的: "3歳の娘" が時間経過で矛盾しないよう、DB保存は生年月日のみ、
 *       ランタイムで "今日時点の年齢" を計算し、年齢帯別に
 *       使っていい語彙 / 禁止語彙を prompt に含める。
 *
 * スキーマ例: account_personas.family_canon
 * {
 *   "era_mode": "real_time_with_flashback",
 *   "family": {
 *     "mother": { "role": "main_character", "age_desc": "30代後半", ... },
 *     "daughter_1": {
 *       "label": "上の子 / お姉ちゃん",
 *       "gender": "F",
 *       "birth_date": "2020-08-15",
 *       "nickname": "娘（姉）",
 *       "traits": ["お姉ちゃんワードに敏感"]
 *     },
 *     "daughter_2": { ... },
 *     "husband": { ... }
 *   },
 *   "vocabulary_guards": {
 *     "allowed_now": [...],
 *     "forbidden_until_YYYY_MM_DD": [...],
 *     "transition_dates": { "YYYY-MM-DD": "..." }
 *   },
 *   "era_policy": { "default": "...", "flashback_ok": "...", "future": "..." }
 * }
 */

type FamilyMember = {
  role?: string;
  label?: string;
  gender?: "M" | "F";
  birth_date?: string; // "YYYY-MM-DD"
  nickname?: string;
  occupation?: string;
  age_desc?: string; // 生年月日がないケース用（例: "30代後半"）
  traits?: string[];
};

type VocabularyGuards = {
  allowed_now?: string[];
  /**
   * 日付の上限付き禁止語。キー形式は自由:
   *   "forbidden_until_2027_04_01" / "forbidden_until_2027-04-01"
   *   "forbidden_until_YYYY-MM-DD" 形式に正規化して扱う
   */
  [forbiddenKey: string]: string[] | Record<string, string> | undefined;
  transition_dates?: Record<string, string>;
};

export type FamilyCanon = {
  era_mode?: "real_time_with_flashback" | "flashback_only" | "real_time_only";
  family?: Record<string, FamilyMember>;
  vocabulary_guards?: VocabularyGuards;
  era_policy?: {
    default?: string;
    flashback_ok?: string;
    future?: string;
  };
};

function calcAgeYears(birthDate: string, asOf: Date): number {
  const b = new Date(birthDate);
  let age = asOf.getFullYear() - b.getFullYear();
  const m = asOf.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < b.getDate())) age--;
  return age;
}

function calcAgeMonths(birthDate: string, asOf: Date): number {
  const b = new Date(birthDate);
  return (asOf.getFullYear() - b.getFullYear()) * 12 + (asOf.getMonth() - b.getMonth()) -
    (asOf.getDate() < b.getDate() ? 1 : 0);
}

/**
 * 日本の学齢カレンダー: 4/1 〜 翌3/31 で学年が切り替わる
 * 4/2 生まれで同学年、4/1 生まれは前学年（早生まれ）
 */
function calcSchoolStage(birthDate: string, asOf: Date): string {
  const ageYears = calcAgeYears(birthDate, asOf);
  const b = new Date(birthDate);
  // 学齢判定用: 4/1 起算でその年度に「〇歳になる」年齢
  const year = asOf.getFullYear();
  const april1ThisYear = new Date(year, 3, 1);
  const schoolAge = asOf >= april1ThisYear
    ? ageYears + (b <= new Date(b.getFullYear(), 3, 1) ? 0 : 0) // 4月以降
    : ageYears;
  // 簡易版: 4月以降で〇歳、3月までで〇歳で切り分け
  const effectiveAge = asOf.getMonth() >= 3
    ? calcAgeYears(birthDate, new Date(year, 3, 1))
    : calcAgeYears(birthDate, new Date(year - 1, 3, 1));

  if (effectiveAge < 1) return "乳児";
  if (effectiveAge === 1) return "保育園（1歳児クラス）";
  if (effectiveAge === 2) return "保育園（2歳児クラス）";
  if (effectiveAge === 3) return "保育園（3歳児クラス / 年少相当）";
  if (effectiveAge === 4) return "保育園（4歳児クラス / 年中相当）";
  if (effectiveAge === 5) return "保育園（5歳児クラス / 年長相当）";
  if (effectiveAge === 6) return "小学1年";
  if (effectiveAge === 7) return "小学2年";
  if (effectiveAge === 8) return "小学3年";
  if (effectiveAge === 9) return "小学4年";
  if (effectiveAge === 10) return "小学5年";
  if (effectiveAge === 11) return "小学6年";
  if (effectiveAge === 12) return "中学1年";
  if (effectiveAge === 13) return "中学2年";
  if (effectiveAge === 14) return "中学3年";
  if (effectiveAge === 15) return "高校1年";
  if (effectiveAge === 16) return "高校2年";
  if (effectiveAge === 17) return "高校3年";
  return `${effectiveAge}歳`;
}

function formatMember(key: string, m: FamilyMember, asOf: Date): string {
  const lines: string[] = [];
  const label = m.label || m.nickname || key;
  lines.push(`- ${label} (${key}):`);
  if (m.birth_date) {
    // 意図的に数値年齢を出さない。出すと Opus が「5歳の娘」のように使ってしまい
    // リアルな母親の語り口から外れる（毎回子の年齢を数字で言うのは不自然）。
    // 段階表現のみに絞る。
    const stage = calcSchoolStage(m.birth_date, asOf);
    lines.push(`  段階: ${stage}`);
  } else if (m.age_desc) {
    lines.push(`  年齢感: ${m.age_desc}`);
  }
  if (m.gender) lines.push(`  性別: ${m.gender === "F" ? "女性" : "男性"}`);
  if (m.occupation) lines.push(`  職業: ${m.occupation}`);
  if (m.nickname && m.nickname !== label) lines.push(`  呼称: ${m.nickname}`);
  if (m.traits && m.traits.length) lines.push(`  特徴: ${m.traits.join(" / ")}`);
  return lines.join("\n");
}

/**
 * date を指定時点の vocabulary_guards から "allowed" と "forbidden_now" を算出。
 * forbidden_until_YYYY-MM-DD キーを解釈する。
 */
function resolveVocabGuards(
  guards: VocabularyGuards | undefined,
  asOf: Date,
): { allowed: string[]; forbidden: string[]; nextTransition: string | null } {
  if (!guards) return { allowed: [], forbidden: [], nextTransition: null };
  const allowed = guards.allowed_now || [];
  const forbidden: string[] = [];
  let nextTransition: string | null = null;
  let nextTransitionDate: Date | null = null;

  for (const [key, value] of Object.entries(guards)) {
    if (!key.startsWith("forbidden_until_")) continue;
    // "forbidden_until_2027_04_01" or "forbidden_until_2027-04-01"
    const dateStr = key
      .replace("forbidden_until_", "")
      .replace(/_/g, "-");
    const untilDate = new Date(dateStr);
    if (isNaN(untilDate.getTime())) continue;
    if (Array.isArray(value) && asOf < untilDate) {
      forbidden.push(...value);
      if (!nextTransitionDate || untilDate < nextTransitionDate) {
        nextTransitionDate = untilDate;
        nextTransition = `${dateStr}: ${value.slice(0, 3).join(" / ")}${value.length > 3 ? "..." : ""} 解禁`;
      }
    }
  }
  return { allowed, forbidden: Array.from(new Set(forbidden)), nextTransition };
}

/**
 * canon を prompt 用ブロックに変換。
 * canon が空なら空文字を返す（既存キャラに家族設定がない場合の互換性）。
 */
export function buildFamilyCanonBlock(
  canon: FamilyCanon | null | undefined,
  asOfDate?: Date | string,
): string {
  if (!canon || !canon.family) return "";
  const asOf = asOfDate ? new Date(asOfDate) : new Date();
  const asOfStr = asOf.toISOString().slice(0, 10);

  const memberBlocks = Object.entries(canon.family)
    .map(([key, m]) => formatMember(key, m, asOf))
    .join("\n");

  const { allowed, forbidden, nextTransition } = resolveVocabGuards(canon.vocabulary_guards, asOf);

  const eraBlock = canon.era_policy
    ? [
        "## 時制ポリシー",
        canon.era_policy.default ? `- 既定: ${canon.era_policy.default}` : "",
        canon.era_policy.flashback_ok ? `- 回想: ${canon.era_policy.flashback_ok}` : "",
        canon.era_policy.future ? `- 未来: ${canon.era_policy.future}` : "",
      ].filter(Boolean).join("\n")
    : "";

  const vocabBlock = [
    "## 語彙ガード（家族言及時・厳守）",
    allowed.length ? `- 今日時点で使ってOKな家族語彙: ${allowed.join(" / ")}` : "",
    forbidden.length
      ? `- 今日時点で絶対に使わない家族語彙（発達年齢と不一致）: ${forbidden.join(" / ")}`
      : "",
    nextTransition ? `- 次の解禁タイミング: ${nextTransition}` : "",
    "## 家族言及の表現ルール（最重要）",
    "- **年齢を数字で書かない**。「5歳の娘」「2歳の妹」のような年齢明記は禁止。",
    "  → リアルな母親は自分の子の年齢を毎回数字で言わない。売り込み臭く不自然に聞こえる",
    "- 代わりに関係詞で表現する: 「娘」「上の子」「下の子」「長女」「次女」「お姉ちゃん」「妹」「息子」",
    "- 年齢帯をどうしても伝えたい時は段階表現: 「保育園児」「年長さん」「まだ乳児」「赤ちゃん」等",
    "- 家族の設定に反する体験談を作らない（例: 保育園児に宿題、乳児に歯磨き嫌がる）",
  ].filter(Boolean).join("\n");

  return [
    "# 家族canon（今日 " + asOfStr + " 時点の canonical 情報・厳守）",
    "",
    "## 家族メンバー",
    memberBlocks,
    "",
    eraBlock,
    "",
    vocabBlock,
  ].filter(Boolean).join("\n");
}

/** 単純な禁止語検査: 生成されたテキストに forbidden 語彙が含まれていないか */
export function detectForbiddenVocab(
  content: string,
  canon: FamilyCanon | null | undefined,
  asOfDate?: Date | string,
): string[] {
  if (!canon || !canon.vocabulary_guards) return [];
  const asOf = asOfDate ? new Date(asOfDate) : new Date();
  const { forbidden } = resolveVocabGuards(canon.vocabulary_guards, asOf);
  return forbidden.filter((word) => content.includes(word));
}
