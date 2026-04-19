/**
 * JST ベースの現在時刻・曜日・祝日コンテキストを返す。
 * 投稿生成 (meeting / generate) で曜日ミスマッチを防ぐために使う。
 *
 * 例: 日曜なのに「保育園送り」「出勤」等の平日専用語彙を使ってしまう事故を防ぐ。
 */

export interface DayContext {
  /** "2026-04-19" 形式（JST） */
  jstDate: string;
  /** 0=日曜, 1=月曜, ..., 6=土曜 */
  dayOfWeekIndex: number;
  /** "日曜" "月曜" ... */
  dayOfWeekJa: string;
  /** "Sunday" "Monday" ... */
  dayOfWeekEn: string;
  /** 土日 or 祝日 */
  isWeekend: boolean;
  /** 日本の祝日 */
  isHoliday: boolean;
  /** 祝日名（isHoliday 時のみ） */
  holidayName: string | null;
  /** is_weekend || is_holiday */
  isOffDay: boolean;
}

// 日本の祝日（2026年）。毎年更新推奨。
// Source: https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html
const JAPANESE_HOLIDAYS_2026: Record<string, string> = {
  "2026-01-01": "元日",
  "2026-01-12": "成人の日",
  "2026-02-11": "建国記念の日",
  "2026-02-23": "天皇誕生日",
  "2026-03-20": "春分の日",
  "2026-04-29": "昭和の日",
  "2026-05-03": "憲法記念日",
  "2026-05-04": "みどりの日",
  "2026-05-05": "こどもの日",
  "2026-05-06": "振替休日",
  "2026-07-20": "海の日",
  "2026-08-11": "山の日",
  "2026-09-21": "敬老の日",
  "2026-09-22": "国民の休日",
  "2026-09-23": "秋分の日",
  "2026-10-12": "スポーツの日",
  "2026-11-03": "文化の日",
  "2026-11-23": "勤労感謝の日",
};

const DOW_JA = ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"];
const DOW_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * 指定日（またはnowのJST換算）の曜日コンテキストを返す。
 * @param dateStr "YYYY-MM-DD" 形式。省略時は now() の JST 換算。
 */
export function getJstDayContext(dateStr?: string): DayContext {
  let year: number, month: number, day: number;
  if (dateStr) {
    const parts = dateStr.split("-").map((n) => parseInt(n, 10));
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else {
    // JST = UTC + 9h
    const jst = new Date(Date.now() + 9 * 3600_000);
    year = jst.getUTCFullYear();
    month = jst.getUTCMonth() + 1;
    day = jst.getUTCDate();
  }
  const jstDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // 曜日計算（Zeller's congruence は複雑なので Date 経由）
  const probe = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeekIndex = probe.getUTCDay();

  const holidayName = JAPANESE_HOLIDAYS_2026[jstDate] ?? null;
  const isHoliday = holidayName !== null;
  const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;
  const isOffDay = isWeekend || isHoliday;

  return {
    jstDate,
    dayOfWeekIndex,
    dayOfWeekJa: DOW_JA[dayOfWeekIndex],
    dayOfWeekEn: DOW_EN[dayOfWeekIndex],
    isWeekend,
    isHoliday,
    holidayName,
    isOffDay,
  };
}

/**
 * AI生成プロンプトに埋め込む用の曜日制約ブロックを生成する。
 * 土日・祝日に平日専用語彙を使わせないための強い指示。
 */
export function buildDayConstraintBlock(ctx: DayContext): string {
  const dayLabel = ctx.isHoliday
    ? `${ctx.dayOfWeekJa}（祝日: ${ctx.holidayName}）`
    : ctx.dayOfWeekJa;

  if (ctx.isOffDay) {
    return `## ⚠️ 日付・曜日の整合性（絶対遵守）

- 本日は **${ctx.jstDate} ${dayLabel}**（休日）
- is_weekend=${ctx.isWeekend} / is_holiday=${ctx.isHoliday}

### 休日なので **使用禁止** の語彙（業務・通学系）
- 保育園 / 幼稚園 / 小学校 / 学校 / 登校 / 登園 / 送り / お迎え
- 出勤 / 退勤 / 通勤 / 電車 / 職場 / 会社 / 上司 / 部下 / 同僚
- 会議 / ミーティング / プレゼン / 打ち合わせ / 商談
- ランチタイム / 昼休み / 給湯室
- 月曜の朝 / 火曜 / 水曜 / 木曜 / 金曜（平日の曜日名は誤記防止のため使わない）

上記語彙が出る場合は、本日の曜日設定と完全に矛盾します。絶対に書かない。

### 代わりに使える語彙
- 休日 / 週末 / 土曜 / 日曜（本日の曜日）
- 家でゴロゴロ / 家族時間 / 公園 / 散歩
- 朝寝坊 / 二度寝 / ブランチ / 午後の昼寝
- 子どもと一日 / 夫と / 家族で
- 時間に追われない / スロースタート`;
  }

  // 平日
  return `## ⚠️ 日付・曜日の整合性（絶対遵守）

- 本日は **${ctx.jstDate} ${dayLabel}**（平日）
- is_weekend=false / is_holiday=false

### 平日なので **使用禁止** の語彙（休日系）
- 休日 / 週末の気分 / 土曜 / 日曜（本日の曜日と矛盾）
- 朝寝坊 / 二度寝（出勤前提の平日には不自然）
- 「今日は休み」系の文脈

### 使える語彙（平日モード）
- 保育園 / 幼稚園 / 学校 / 出勤 / 通勤 / 会社 / 会議
- ランチ / 帰宅 / お迎え
- 朝7時の保育園バッグ、夜23時半の真顔 など
- 本日の曜日: ${ctx.dayOfWeekJa}`;
}
