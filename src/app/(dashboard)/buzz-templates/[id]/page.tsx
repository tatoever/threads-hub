"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function EditBuzzTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/buzz-templates/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error);
        else {
          setForm({
            ...d,
            tags: (d.tags || []).join(", "),
            requires_cta_type: d.requires_cta_type || "",
            cta_placement: d.cta_placement || "",
            length_hint: d.length_hint || "",
            description: d.description || "",
          });
        }
        setLoading(false);
      });
  }, [id]);

  async function save() {
    setErr(null);
    setSaving(true);
    const payload = {
      ...form,
      requires_cta_type: form.requires_cta_type || null,
      cta_placement: form.cta_placement || null,
      length_hint: form.length_hint || null,
      tags: form.tags ? form.tags.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    };
    const res = await fetch(`/api/buzz-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) router.push("/buzz-templates");
    else setErr((await res.json()).error || "保存失敗");
  }

  async function remove() {
    if (!confirm(`「${form.name}」を削除しますか？`)) return;
    const res = await fetch(`/api/buzz-templates/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/buzz-templates");
    else setErr("削除失敗");
  }

  if (loading) return <div className="p-6 text-gray-400">読み込み中...</div>;
  if (!form) return <div className="p-6 text-red-400">{err || "テンプレが見つかりません"}</div>;

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <Link href="/buzz-templates" className="text-sm text-gray-400 hover:text-gray-200">
        ← 一覧に戻る
      </Link>
      <h1 className="text-2xl font-bold">{form.name || form.code}</h1>

      <div className="space-y-4 rounded-lg border border-gray-800 bg-gray-900 p-6">
        <Field label="code (unique)">
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-mono"
          />
        </Field>

        <Field label="名前">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="description">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="prompt_body">
          <textarea
            value={form.prompt_body}
            onChange={(e) => setForm({ ...form, prompt_body: e.target.value })}
            rows={14}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-mono"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="requires_cta_type">
            <input
              value={form.requires_cta_type}
              onChange={(e) => setForm({ ...form, requires_cta_type: e.target.value })}
              className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="cta_placement">
            <input
              value={form.cta_placement}
              onChange={(e) => setForm({ ...form, cta_placement: e.target.value })}
              className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="length_hint">
          <input
            value={form.length_hint}
            onChange={(e) => setForm({ ...form, length_hint: e.target.value })}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="tags (カンマ区切り)">
          <input
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          有効化
        </label>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <div className="flex gap-2 justify-between">
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-700"
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
          <button
            onClick={remove}
            className="rounded-md border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-red-950"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}
