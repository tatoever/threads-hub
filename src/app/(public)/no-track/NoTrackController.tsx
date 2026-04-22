"use client";

import * as React from "react";

type Exclusion = {
  id: string;
  device_id: string;
  label: string | null;
  user_agent: string | null;
  platform: string | null;
  timezone: string | null;
  language: string | null;
  screen_size: string | null;
  is_active: boolean;
  excluded_at: string;
  last_seen_at: string;
  revoked_at: string | null;
};

type Status = "loading" | "excluded" | "tracked";

function getOrCreateDeviceId(): string {
  const KEY = "noTrackDeviceId";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `anon-${Date.now()}`;
  }
}

function collectBrowserInfo() {
  try {
    return {
      user_agent: navigator.userAgent,
      platform: (navigator as any).userAgentData?.platform ?? navigator.platform ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      screen_size: `${screen.width}x${screen.height}`,
    };
  } catch {
    return {};
  }
}

function inferDefaultLabel(ua: string): string {
  const m = ua.match(/Windows NT ([\d.]+)/);
  if (m) {
    const ver: Record<string, string> = { "10.0": "Windows 10/11", "6.3": "Windows 8.1", "6.1": "Windows 7" };
    return ver[m[1]] ?? "Windows";
  }
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  return "このブラウザ";
}

function shortenUA(ua: string | null): string {
  if (!ua) return "-";
  const parts: string[] = [];
  if (/Windows/i.test(ua)) parts.push("Windows");
  else if (/Macintosh|Mac OS X/i.test(ua)) parts.push("Mac");
  else if (/iPhone/i.test(ua)) parts.push("iPhone");
  else if (/iPad/i.test(ua)) parts.push("iPad");
  else if (/Android/i.test(ua)) parts.push("Android");
  else if (/Linux/i.test(ua)) parts.push("Linux");

  if (/Edg\//i.test(ua)) parts.push("Edge");
  else if (/Chrome\//i.test(ua)) parts.push("Chrome");
  else if (/Firefox\//i.test(ua)) parts.push("Firefox");
  else if (/Safari\//i.test(ua)) parts.push("Safari");

  return parts.join(" / ") || ua.slice(0, 40);
}

function formatJST(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function NoTrackController() {
  const [status, setStatus] = React.useState<Status>("loading");
  const [deviceId, setDeviceId] = React.useState<string | null>(null);
  const [label, setLabel] = React.useState<string>("");
  const [exclusions, setExclusions] = React.useState<Exclusion[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const readLocalStatus = (): Status =>
    typeof localStorage !== "undefined" && localStorage.getItem("noTrack") === "1"
      ? "excluded"
      : "tracked";

  const fetchList = React.useCallback(async () => {
    try {
      const res = await fetch("/api/no-track/list", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setExclusions(data.exclusions ?? []);
    } catch {}
  }, []);

  React.useEffect(() => {
    // URLパラメータ ?set=1|0 即時切替
    try {
      const params = new URLSearchParams(window.location.search);
      const set = params.get("set");
      if (set === "1") localStorage.setItem("noTrack", "1");
      else if (set === "0") localStorage.removeItem("noTrack");
    } catch {}

    const id = getOrCreateDeviceId();
    setDeviceId(id);

    // デフォルトラベル推測
    try {
      setLabel(inferDefaultLabel(navigator.userAgent));
    } catch {}

    setStatus(readLocalStatus());
    fetchList();
  }, [fetchList]);

  const enable = async () => {
    if (!deviceId) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch("/api/no-track/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          label: label.trim() || null,
          ...collectBrowserInfo(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "登録に失敗しました");
      localStorage.setItem("noTrack", "1");
      setStatus("excluded");
      await fetchList();
    } catch (e: any) {
      setErr(e.message ?? "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  const disable = async (targetDeviceId?: string) => {
    const targetId = targetDeviceId ?? deviceId;
    if (!targetId) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch("/api/no-track/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: targetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解除に失敗しました");
      // 自デバイスを解除した場合は localStorage も外す
      if (targetId === deviceId) {
        localStorage.removeItem("noTrack");
        setStatus("tracked");
      }
      await fetchList();
    } catch (e: any) {
      setErr(e.message ?? "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || !deviceId) {
    return (
      <div className="rounded-lg border border-neutral-200 p-5 bg-neutral-50 text-sm text-neutral-500">
        現在の状態を確認中...
      </div>
    );
  }

  const isExcluded = status === "excluded";

  return (
    <div className="space-y-6">
      {/* 現在のブラウザステータス */}
      <div
        className={`rounded-lg border p-5 space-y-4 ${
          isExcluded ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
        }`}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isExcluded ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
            }`}
          >
            {isExcluded ? "● 計測除外中" : "● 計測対象"}
          </span>
          <span className="text-sm text-neutral-700">
            {isExcluded
              ? "このブラウザからのアクセスはアナリティクスに記録されません"
              : "このブラウザのアクセスは現在、アナリティクスに記録されます"}
          </span>
        </div>

        {!isExcluded && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-neutral-700 mb-1 block">
                このブラウザのラベル（あとで見分けるため）
              </span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value.slice(0, 80))}
                placeholder="例: メインPC / 出先ノート / iPhone"
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                maxLength={80}
              />
            </label>
            <button
              onClick={enable}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-50"
            >
              {submitting ? "登録中..." : "このブラウザを計測から除外する"}
            </button>
          </div>
        )}

        {isExcluded && (
          <button
            onClick={() => disable()}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition disabled:opacity-50"
          >
            {submitting ? "解除中..." : "このブラウザの除外を解除する"}
          </button>
        )}

        {err && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</p>
        )}

        <p className="text-[11px] text-neutral-500 font-mono">
          device_id: {deviceId.slice(0, 12)}...
        </p>
      </div>

      {/* 除外中のデバイス一覧 */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">除外中のブラウザ / デバイス一覧</h2>
          <button
            onClick={fetchList}
            className="text-xs text-neutral-500 hover:text-neutral-900 underline"
          >
            再読み込み
          </button>
        </div>

        {exclusions.length === 0 ? (
          <p className="text-sm text-neutral-500">まだ登録されたデバイスはありません</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {exclusions.map((x) => {
              const isSelf = x.device_id === deviceId;
              return (
                <li key={x.id} className="py-3 flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {x.label || "（ラベルなし）"}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] bg-emerald-600 text-white rounded-full px-1.5 py-0.5 font-semibold">
                          このブラウザ
                        </span>
                      )}
                      <span className="text-xs text-neutral-500">{shortenUA(x.user_agent)}</span>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      登録: {formatJST(x.excluded_at)} · 最終確認: {formatJST(x.last_seen_at)}
                    </div>
                    <div className="text-[10px] text-neutral-400 font-mono truncate">
                      {x.platform} · {x.timezone} · {x.screen_size} · {x.language}
                    </div>
                  </div>
                  <button
                    onClick={() => disable(x.device_id)}
                    disabled={submitting}
                    className="text-xs text-neutral-600 hover:text-red-700 hover:bg-red-50 border border-neutral-300 rounded px-2 py-1 disabled:opacity-50"
                  >
                    解除
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
