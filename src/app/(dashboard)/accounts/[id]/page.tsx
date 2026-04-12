"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/accounts/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setAccount(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-6 text-gray-400">読み込み中...</div>;
  if (!account) return <div className="p-6 text-red-400">アカウントが見つかりません</div>;

  const persona = Array.isArray(account.account_personas)
    ? account.account_personas[0]
    : account.account_personas;
  const token = Array.isArray(account.account_tokens)
    ? account.account_tokens[0]
    : account.account_tokens;
  const ctaDestinations = account.cta_destinations || [];
  const researchSources = account.research_sources || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{persona?.display_name || account.name}</h1>
          <p className="text-gray-400 text-sm">
            @{account.slug} / {persona?.genre || "ジャンル未設定"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={account.status} />
          <StatusToggle accountId={id} currentStatus={account.status} />
        </div>
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="モデル" value={account.default_model === "opus" ? "Opus" : "Sonnet"} />
        <StatCard label="投稿/日" value={`${account.daily_post_target}本`} />
        <StatCard
          label="API接続"
          value={token?.status === "active" ? "接続済" : "未接続"}
          variant={token?.status === "active" ? "success" : "warning"}
        />
        <StatCard label="CTA登録" value={`${ctaDestinations.length}件`} />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Persona */}
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">ペルソナ</h2>
            <Link
              href={`/accounts/${id}/persona`}
              className="text-blue-400 text-sm hover:underline"
            >
              編集
            </Link>
          </div>
          {persona ? (
            <dl className="space-y-2 text-sm">
              <DetailRow label="ジャンル" value={persona.genre} />
              <DetailRow label="ニッチ" value={persona.niche} />
              <DetailRow label="ターゲット" value={persona.target_audience} />
              <DetailRow label="口調" value={persona.tone_style} />
              <DetailRow label="年齢感" value={persona.age_range} />
              <DetailRow label="性別感" value={persona.gender_feel} />
              <DetailRow label="背景" value={persona.background} />
              <DetailRow
                label="禁止ワード"
                value={persona.prohibited_words?.join(", ") || "なし"}
              />
            </dl>
          ) : (
            <p className="text-gray-500 text-sm">未設定</p>
          )}
        </section>

        {/* Right: API & Auth */}
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-4">API接続</h2>
          {token?.status === "active" ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-green-400">Threads API 接続済み</span>
              </div>
              <DetailRow label="Threads ID" value={account.threads_user_id || "-"} />
              <DetailRow
                label="トークン期限"
                value={
                  token.token_expires_at
                    ? new Date(token.token_expires_at).toLocaleDateString("ja-JP")
                    : "-"
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-yellow-400 text-sm">Threads APIに接続されていません</p>
              <a
                href={`/api/auth/threads?account_id=${id}`}
                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
              >
                Threads認証を開始
              </a>
            </div>
          )}
        </section>
      </div>

      {/* CTA Destinations */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            CTA誘導先 ({ctaDestinations.length}件)
          </h2>
          <Link
            href={`/accounts/${id}/cta`}
            className="text-blue-400 text-sm hover:underline"
          >
            管理
          </Link>
        </div>
        {ctaDestinations.length > 0 ? (
          <div className="space-y-2">
            {ctaDestinations.map((cta: any) => (
              <div
                key={cta.id}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0 text-sm"
              >
                <div>
                  <span className="font-medium">{cta.name}</span>
                  <span className="text-gray-500 ml-2">({cta.cta_type})</span>
                </div>
                <div className="text-gray-400 text-xs">
                  {cta.total_placements}回配置済
                  {!cta.is_active && <span className="text-red-400 ml-2">停止中</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            誘導先が未登録です。
            <Link href={`/accounts/${id}/cta`} className="text-blue-400 hover:underline ml-1">
              追加する
            </Link>
          </p>
        )}
      </section>

      {/* Research Sources */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            リサーチソース ({researchSources.length}件)
          </h2>
          <Link
            href={`/accounts/${id}/research`}
            className="text-blue-400 text-sm hover:underline"
          >
            管理
          </Link>
        </div>
        {researchSources.length > 0 ? (
          <div className="space-y-2">
            {researchSources.map((src: any) => (
              <div
                key={src.id}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0 text-sm"
              >
                <div>
                  <span className="font-medium capitalize">{src.source_type}</span>
                  <span className="text-gray-500 ml-2">
                    {src.config?.queries?.join(", ") || src.config?.url || ""}
                  </span>
                </div>
                <span className={src.is_active ? "text-green-400 text-xs" : "text-gray-500 text-xs"}>
                  {src.is_active ? "有効" : "無効"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">リサーチソースが未設定です</p>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-900 text-green-300",
    testing: "bg-yellow-900 text-yellow-300",
    setup: "bg-gray-700 text-gray-300",
    paused: "bg-red-900 text-red-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${styles[status] || styles.setup}`}>
      {status}
    </span>
  );
}

function StatusToggle({
  accountId,
  currentStatus,
}: {
  accountId: string;
  currentStatus: string;
}) {
  const [updating, setUpdating] = useState(false);

  async function toggleStatus() {
    setUpdating(true);
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    await fetch(`/api/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    window.location.reload();
  }

  if (currentStatus === "setup") return null;

  return (
    <button
      onClick={toggleStatus}
      disabled={updating}
      className="px-3 py-1 text-xs border border-gray-600 rounded-lg hover:bg-gray-800 disabled:opacity-50"
    >
      {currentStatus === "active" ? "一時停止" : "再開"}
    </button>
  );
}

function StatCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "success" | "warning";
}) {
  const colors = {
    default: "text-white",
    success: "text-green-400",
    warning: "text-yellow-400",
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className={`text-lg font-bold mt-1 ${colors[variant]}`}>{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex">
      <dt className="w-24 text-gray-500 shrink-0">{label}</dt>
      <dd className="text-gray-200">{value || "-"}</dd>
    </div>
  );
}
