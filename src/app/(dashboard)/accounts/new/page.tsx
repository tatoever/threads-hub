"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAccountPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    persona: {
      display_name: "",
      genre: "",
      niche: "",
      target_audience: "",
      value_proposition: "",
      tone_style: "",
      age_range: "",
      gender_feel: "",
      background: "",
      prohibited_words: "",
    },
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updatePersona(field: string, value: string) {
    setForm((prev) => ({
      ...prev,
      persona: { ...prev.persona, [field]: value },
    }));
  }

  async function handleSubmit() {
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug,
      persona: {
        ...form.persona,
        prohibited_words: form.persona.prohibited_words
          .split(",")
          .map((w) => w.trim())
          .filter(Boolean),
      },
    };

    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const account = await res.json();
      router.push(`/accounts/${account.id}`);
    } else {
      alert("作成に失敗しました");
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">新規アカウント追加</h1>

      {/* Step indicator */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded-full ${
              s <= step ? "bg-blue-500" : "bg-gray-700"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Basic info */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">基本情報</h2>
          <Field
            label="アカウント名"
            value={form.name}
            onChange={(v) => updateField("name", v)}
            placeholder="例: おきつねさま"
          />
          <Field
            label="スラッグ（URL用）"
            value={form.slug}
            onChange={(v) => updateField("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="例: okitsune"
          />
          <Field
            label="表示名"
            value={form.persona.display_name}
            onChange={(v) => updatePersona("display_name", v)}
            placeholder="例: おきつねさま"
          />
          <button
            onClick={() => setStep(2)}
            disabled={!form.name || !form.slug}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium"
          >
            次へ
          </button>
        </div>
      )}

      {/* Step 2: Persona */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">ペルソナ設定</h2>
          <Field
            label="ジャンル"
            value={form.persona.genre}
            onChange={(v) => updatePersona("genre", v)}
            placeholder="例: 占い・スピリチュアル"
          />
          <Field
            label="ニッチ"
            value={form.persona.niche}
            onChange={(v) => updatePersona("niche", v)}
            placeholder="例: 霊視 × 星読み × 恋愛相談"
          />
          <Field
            label="ターゲット層"
            value={form.persona.target_audience}
            onChange={(v) => updatePersona("target_audience", v)}
            placeholder="例: 20-40代女性、恋愛に悩む人"
          />
          <Field
            label="価値提案"
            value={form.persona.value_proposition}
            onChange={(v) => updatePersona("value_proposition", v)}
            placeholder="例: 霊視で見えた真実を本音で伝える"
          />
          <Field
            label="口調"
            value={form.persona.tone_style}
            onChange={(v) => updatePersona("tone_style", v)}
            placeholder="例: カジュアルで親しみやすい兄貴キャラ"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 bg-gray-700 rounded-lg text-sm"
            >
              戻る
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!form.persona.genre || !form.persona.tone_style}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium"
            >
              次へ
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Details */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">キャラクター詳細</h2>
          <Field
            label="年齢感"
            value={form.persona.age_range}
            onChange={(v) => updatePersona("age_range", v)}
            placeholder="例: 30代後半"
          />
          <Field
            label="性別感"
            value={form.persona.gender_feel}
            onChange={(v) => updatePersona("gender_feel", v)}
            placeholder="例: 男。兄貴キャラ"
          />
          <TextArea
            label="バックグラウンド"
            value={form.persona.background}
            onChange={(v) => updatePersona("background", v)}
            placeholder="例: 占い歴17年、曾祖母の代からの拝み屋家系"
          />
          <Field
            label="禁止ワード（カンマ区切り）"
            value={form.persona.prohibited_words}
            onChange={(v) => updatePersona("prohibited_words", v)}
            placeholder="例: ..., ——, 届くべき人"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 bg-gray-700 rounded-lg text-sm"
            >
              戻る
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium"
            >
              {saving ? "作成中..." : "アカウント作成"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
      />
    </div>
  );
}
