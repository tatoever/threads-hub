"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Account {
  id: string;
  name: string;
  slug: string;
  status: string;
  daily_post_target: number;
  default_model: string;
  account_personas: any;
  account_tokens: any;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-6 text-gray-400">読み込み中...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">アカウント管理</h1>
        <Link
          href="/accounts/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
        >
          + 新規追加
        </Link>
      </div>

      <div className="grid gap-4">
        {accounts.map((account) => {
          const persona = Array.isArray(account.account_personas)
            ? account.account_personas[0]
            : account.account_personas;
          const token = Array.isArray(account.account_tokens)
            ? account.account_tokens[0]
            : account.account_tokens;

          return (
            <Link
              key={account.id}
              href={`/accounts/${account.id}`}
              className="block bg-gray-900 border border-gray-800 rounded-lg p-5 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">
                      {persona?.display_name || account.name}
                    </h2>
                    <StatusBadge status={account.status} />
                  </div>
                  <p className="text-gray-400 text-sm mt-1">
                    @{account.slug} / {persona?.genre || "ジャンル未設定"} / {persona?.niche || ""}
                  </p>
                </div>
                <div className="text-right text-sm text-gray-400">
                  <p>{account.daily_post_target}本/日</p>
                  <p className="text-xs">
                    {account.default_model === "opus" ? "Opus" : "Sonnet"}
                  </p>
                  <p className="text-xs mt-1">
                    {token?.status === "active" ? (
                      <span className="text-green-400">API接続済</span>
                    ) : (
                      <span className="text-yellow-400">未接続</span>
                    )}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}

        {accounts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">まだアカウントがありません</p>
            <p className="text-sm mt-2">「+ 新規追加」から始めましょう</p>
          </div>
        )}
      </div>
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
