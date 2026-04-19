/**
 * JST 時刻と時間帯ラベル・曜日コンテキストを返す。userPrompt に埋め込む用途。
 */

import { getJstDayContext, type DayContext } from "../utils/day-context";

export interface TimeContext {
  nowJstIso: string;      // "2026-04-18 14:35"
  timeBand: string;       // "朝" | "昼" | "夕方" | "夜" | "深夜"
  dayContext: DayContext; // 曜日・祝日・is_weekend 等
}

export function getJstTimeContext(now: Date = new Date()): TimeContext {
  const jst = new Date(now.getTime() + 9 * 3600_000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  const hour = jst.getUTCHours();

  const timeBand =
    hour >= 5 && hour < 11 ? "朝" :
    hour >= 11 && hour < 15 ? "昼" :
    hour >= 15 && hour < 18 ? "夕方" :
    hour >= 18 && hour < 23 ? "夜" : "深夜";

  return {
    nowJstIso: `${y}-${m}-${d} ${hh}:${mm}`,
    timeBand,
    dayContext: getJstDayContext(`${y}-${m}-${d}`),
  };
}

export function formatCommentReceivedTime(isoString: string): string {
  const d = new Date(isoString);
  const jst = new Date(d.getTime() + 9 * 3600_000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm} JST`;
}
