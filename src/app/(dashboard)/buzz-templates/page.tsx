"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BuzzTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  prompt_body: string;
  requires_cta_type: string | null;
  cta_placement: string | null;
  length_hint: string | null;
  is_active: boolean;
  tags: string[];
  avg_engagement: any;
  updated_at: string;
}

export default function BuzzTemplatesPage() {
  const [items, setItems] = useState<BuzzTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/buzz-templates");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/buzz-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !active }),
    });
    load();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">バズ構文ライブラリ</h1>
          <p className="text-sm text-gray-400">
            全アカウント共通のバズフック型。meeting phase が各スロットに振り分け、generate.ts が prompt_body を読んで生成する。
          </p>
        </div>
        <Link
          href="/buzz-templates/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + 新規追加
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-400">読み込み中...</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
          <p className="text-gray-400">まだテンプレが登録されていません</p>
          <Link
            href="/buzz-templates/new"
            className="mt-4 inline-block text-sm text-blue-400 hover:underline"
          >
            最初のテンプレを追加する →
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="p-3">有効</th>
                <th className="p-3">code</th>
                <th className="p-3">名前</th>
                <th className="p-3">長さ</th>
                <th className="p-3">CTA 要件</th>
                <th className="p-3">tags</th>
                <th className="p-3">更新</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="p-3">
                    <button
                      onClick={() => toggleActive(t.id, t.is_active)}
                      className={`text-xs px-2 py-1 rounded ${
                        t.is_active
                          ? "bg-green-900 text-green-300"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {t.is_active ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-400">{t.code}</td>
                  <td className="p-3">{t.name}</td>
                  <td className="p-3 text-xs text-gray-400">{t.length_hint || "-"}</td>
                  <td className="p-3 text-xs">
                    {t.requires_cta_type ? (
                      <span className="rounded bg-amber-900/50 px-2 py-0.5 text-amber-300">
                        {t.requires_cta_type}
                      </span>
                    ) : (
                      <span className="text-gray-600">なし</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-gray-400">
                    {(t.tags || []).slice(0, 3).join(", ")}
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {new Date(t.updated_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/buzz-templates/${t.id}`}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      編集
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
