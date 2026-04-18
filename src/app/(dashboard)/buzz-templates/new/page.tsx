"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewBuzzTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    prompt_body: "",
    requires_cta_type: "",
    cta_placement: "",
    length_hint: "",
    tags: "",
    is_active: true,
  });

  async function save() {
    setErr(null);
    setSaving(true);
    const res = await fetch("/api/buzz-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        requires_cta_type: form.requires_cta_type || null,
        cta_placement: form.cta_placement || null,
        length_hint: form.length_hint || null,
        tags: form.tags ? form.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      }),
    });
    setSaving(false);
    if (res.ok) {
      router.push("/buzz-templates");
    } else {
      const j = await res.json();
      setErr(j.error || "保存に失敗");
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/buzz-templates" className="text-sm text-gray-400 hover:text-gray-200">
            ← 一覧に戻る
          </Link>
          <h1 className="text-2xl font-bold mt-2">新規バズ構文テンプレ</h1>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-800 bg-gray-900 p-6">
        <Field label="code (英数・unique)" hint="例: selective / prophecy / empathy">
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-mono"
            placeholder="selective"
          />
        </Field>

        <Field label="名前（人が見るラベル）">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
            placeholder="選民フック"
          />
        </Field>

        <Field label="description（意図・2-3行）">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="prompt_body（Opusに渡す差分指示 ※例文は書かずキャラ色は残す）">
          <textarea
            value={form.prompt_body}
            onChange={(e) => setForm({ ...form, prompt_body: e.target.value })}
            rows={10}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-mono"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="requires_cta_type" hint="例: note_url (無指定なら空白)">
            <input
              value={form.requires_cta_type}
              onChange={(e) => setForm({ ...form, requires_cta_type: e.target.value })}
              className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="cta_placement" hint="例: reply_tree_tail">
            <input
              value={form.cta_placement}
              onChange={(e) => setForm({ ...form, cta_placement: e.target.value })}
              className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="length_hint" hint="例: 40-100 / 80-150 / tree_200x3">
          <input
            value={form.length_hint}
            onChange={(e) => setForm({ ...form, length_hint: e.target.value })}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="tags（カンマ区切り）">
          <input
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
            placeholder="短文, ツリー必須"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          有効化する
        </label>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || !form.code || !form.name || !form.prompt_body}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500"
          >
            {saving ? "保存中..." : "保存"}
          </button>
          <Link
            href="/buzz-templates"
            className="rounded-md border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800"
          >
            キャンセル
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {hint && <span className="ml-2 text-xs text-gray-500">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
