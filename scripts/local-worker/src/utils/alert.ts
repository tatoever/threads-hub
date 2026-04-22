/**
 * アラート発火ヘルパー
 *
 * 設計原則:
 *   - 発火箇所（publish.ts / analytics.ts / queue-worker.ts 他）は常に insertAlert を呼ぶ
 *   - alert_configs.enabled が false の種別は insert をスキップ（管理画面からON/OFF切替可能）
 *   - severity 未指定時は alert_configs.default_severity を使う
 *   - Discord webhook が設定されていれば同時通知
 */

import { supabase } from "./supabase";
import { notifyDiscord } from "./notify";

type Severity = "critical" | "warning" | "info";

export interface InsertAlertOptions {
  account_id: string | null;
  alert_type: string;
  message: string;
  severity?: Severity; // 省略時は alert_configs.default_severity
  skipDiscord?: boolean;
}

// 設定のメモリキャッシュ（60秒）
let configCache: Map<string, { enabled: boolean; default_severity: Severity }> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

async function loadConfigs(): Promise<Map<string, { enabled: boolean; default_severity: Severity }>> {
  const now = Date.now();
  if (configCache && now - cacheLoadedAt < CACHE_TTL_MS) return configCache;

  const { data, error } = await supabase
    .from("alert_configs")
    .select("alert_type, enabled, default_severity");

  const map = new Map<string, { enabled: boolean; default_severity: Severity }>();
  if (!error && data) {
    for (const row of data) {
      map.set(row.alert_type, {
        enabled: row.enabled,
        default_severity: (row.default_severity as Severity) || "warning",
      });
    }
  }
  configCache = map;
  cacheLoadedAt = now;
  return map;
}

/**
 * system_alerts に insert する。
 * alert_configs.enabled=false の種別はスキップ（ON/OFF機能）。
 * 未登録の alert_type は念のため通す（後方互換）。
 */
export async function insertAlert(opts: InsertAlertOptions): Promise<boolean> {
  const configs = await loadConfigs();
  const cfg = configs.get(opts.alert_type);

  if (cfg && cfg.enabled === false) {
    // 無効化されている種別: 黙って return（ログは最小限）
    console.log(`[alert] skipped (disabled): ${opts.alert_type}`);
    return false;
  }

  const severity: Severity = opts.severity ?? cfg?.default_severity ?? "warning";

  const { error } = await supabase.from("system_alerts").insert({
    account_id: opts.account_id,
    alert_type: opts.alert_type,
    severity,
    message: opts.message,
  });

  if (error) {
    console.error(`[alert] insert failed for ${opts.alert_type}:`, error.message);
    return false;
  }

  // Discord 通知（オプション）
  if (!opts.skipDiscord) {
    const prefix = opts.account_id ? `[${opts.alert_type}]` : `[${opts.alert_type}]`;
    await notifyDiscord(`${prefix} ${opts.message}`, severity).catch(() => {});
  }

  return true;
}

/** キャッシュを強制クリア（テスト用/ON/OFF切替直後用） */
export function clearAlertConfigCache(): void {
  configCache = null;
  cacheLoadedAt = 0;
}
