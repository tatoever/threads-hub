"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface CtaDestination {
  id: string;
  name: string;
  cta_type: string;
  url: string;
  description: string | null;
  cta_templates: string[];
  placement_rules: any;
  is_active: boolean;
  priority: number;
  total_placements: number;
  expires_at: string | null;
}

export default function CtaManagementPage() {
  const { id: accountId } = useParams<{ id: string }>();
  const [destinations, setDestinations] = useState<CtaDestination[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cta_type: "note_url" as string,
    url: "",
    description: "",
    cta_templates: "",
    frequency: "1_in_3",
    method: "reply_tree",
    daily_max: "3",
    cooldown_hours: "4",
  });

  useEffect(() => {
    loadDestinations();
  }, [accountId]);

  async function loadDestinations() {
    const res = await fetch(`/api/accounts/${accountId}/cta`);
    if (res.ok) setDestinations(await res.json());
  }

  async function handleSubmit() {
    setSaving(true);
    const payload = {
      account_id: accountId,
      name: form.name,
      cta_type: form.cta_type,
      url: form.url,
      description: form.description || null,
      cta_templates: form.cta_templates.split("\n").filter(Boolean),
      placement_rules: {
        method: form.method,
        frequency: form.frequency,
        daily_max: parseInt(form.daily_max),
        cooldown_hours: parseInt(form.cooldown_hours),
      },
    };

    const res = await fetch(`/api/accounts/${accountId}/cta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setShowForm(false);
      setForm({
        name: "", cta_type: "note_url", url: "", description: "",
        cta_templates: "", frequency: "1_in_3", method: "reply_tree",
        daily_max: "3", cooldown_hours: "4",
      });
      loadDestinations();
    }
    setSaving(false);
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CTA誘導先管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
        >
          {showForm ? "キャンセル" : "+ 追加"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">名前</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例: ココナラ鑑定"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">種別</label>
              <select
                value={form.cta_type}
                onChange={(e) => setForm({ ...form, cta_type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              >
                <option value="note_url">note URL</option>
                <option value="profile_link">プロフリンク</option>
                <option value="affiliate">アフィリエイト</option>
                <option value="external">外部リンク</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">URL</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              誘導文バリエーション（1行1パターン）
            </label>
            <textarea
              value={form.cta_templates}
              onChange={(e) => setForm({ ...form, cta_templates: e.target.value })}
              placeholder={"詳しくはプロフのリンクから\n気になった人はプロフ見てみて\n続きはnoteに書いた"}
              rows={4}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">配置方法</label>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              >
                <option value="reply_tree">ツリー返信</option>
                <option value="post_body">投稿本文</option>
                <option value="profile_mention">プロフ誘導</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">頻度</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              >
                <option value="every">毎投稿</option>
                <option value="1_in_3">3投稿に1回</option>
                <option value="1_in_5">5投稿に1回</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">1日上限</label>
              <input
                type="number"
                value={form.daily_max}
                onChange={(e) => setForm({ ...form, daily_max: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">間隔(時間)</label>
              <input
                type="number"
                value={form.cooldown_hours}
                onChange={(e) => setForm({ ...form, cooldown_hours: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.name || !form.url}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium"
          >
            {saving ? "保存中..." : "追加"}
          </button>
        </div>
      )}

      {/* Destinations list */}
      <div className="space-y-3">
        {destinations.map((cta) => (
          <div
            key={cta.id}
            className={`bg-gray-900 border rounded-lg p-4 ${
              cta.is_active ? "border-gray-800" : "border-gray-800 opacity-50"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{cta.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-700 rounded-full">
                    {cta.cta_type}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-gray-700 rounded-full">
                    {cta.placement_rules?.method || "reply_tree"}
                  </span>
                </div>
                <p className="text-gray-400 text-xs mt-1 truncate max-w-md">{cta.url}</p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>{cta.total_placements}回配置済</p>
                <p>
                  {cta.placement_rules?.frequency || "1_in_3"} / 上限{cta.placement_rules?.daily_max || 3}/日
                </p>
              </div>
            </div>
            {cta.cta_templates && cta.cta_templates.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-gray-500">バリエーション:</p>
                {cta.cta_templates.map((t, i) => (
                  <p key={i} className="text-xs text-gray-300 pl-3">
                    {i + 1}. {t}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
        {destinations.length === 0 && (
          <p className="text-center py-8 text-gray-500">
            誘導先がまだ登録されていません
          </p>
        )}
      </div>
    </div>
  );
}
