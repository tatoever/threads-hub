"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [testResult, setTestResult] = useState<string | null>(null);

  async function testDiscord() {
    setTestResult("送信中...");
    const res = await fetch("/api/settings/test-discord", { method: "POST" });
    if (res.ok) {
      setTestResult("送信完了!");
    } else {
      setTestResult("失敗");
    }
  }

  async function triggerPipeline() {
    if (!confirm("全アクティブアカウントのパイプラインを開始しますか?")) return;
    const res = await fetch("/api/cron/pipeline", {
      headers: { Authorization: `Bearer ${prompt("CRON_SECRET を入力:")}` },
    });
    const data = await res.json();
    alert(JSON.stringify(data, null, 2));
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold">設定</h1>

      {/* System info */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold mb-4">システム情報</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex">
            <dt className="w-40 text-gray-500">プロジェクト</dt>
            <dd>threads-hub</dd>
          </div>
          <div className="flex">
            <dt className="w-40 text-gray-500">アーキテクチャ</dt>
            <dd>Next.js + Supabase + PM2 Worker</dd>
          </div>
          <div className="flex">
            <dt className="w-40 text-gray-500">AI生成</dt>
            <dd>ローカルCLI (claude -p)</dd>
          </div>
        </dl>
      </section>

      {/* Manual triggers */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold mb-4">手動トリガー</h2>
        <div className="space-y-3">
          <button
            onClick={triggerPipeline}
            className="block w-full text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            <span className="font-medium">朝パイプライン実行</span>
            <span className="text-gray-400 ml-2">全アカウントのPhase 1-4を開始</span>
          </button>
        </div>
      </section>

      {/* Discord test */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold mb-4">Discord通知テスト</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={testDiscord}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium"
          >
            テスト送信
          </button>
          {testResult && <span className="text-sm text-gray-400">{testResult}</span>}
        </div>
      </section>
    </div>
  );
}
