"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Proposal = {
  id: string;
  proposal_rank: number;
  concept_name: string;
  means_shift: string;
  position_shift: string;
  establishment_reason: string;
  weirdness_score: number;
  target_reaction_prediction: {
    positive?: string[];
    negative?: string[];
  };
  status: string;
};

type ConceptData = {
  account: {
    id: string;
    name: string;
    slug: string;
    concept_status: string;
    concept_definition: any;
  };
  research: any[];
  analysis: any;
  proposals: Proposal[];
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending_research: { label: "🔴 Pending", color: "bg-red-100 text-red-800" },
  researching: { label: "🔵 Researching", color: "bg-blue-100 text-blue-800" },
  ready_for_review: { label: "🟡 Ready for Review", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "🟢 Approved", color: "bg-green-100 text-green-800" },
  locked: { label: "✅ Locked", color: "bg-gray-100 text-gray-800" },
};

const RANK_LABEL: Record<number, string> = {
  1: "推奨",
  2: "攻め",
  3: "安全",
};

export default function ConceptPage() {
  const params = useParams();
  const accountId = params?.id as string;

  const [data, setData] = useState<ConceptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRank, setExpandedRank] = useState<number | null>(null);
  const [rejectingFeedback, setRejectingFeedback] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/accounts/${accountId}/concept`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [accountId]);

  async function approveProposal(proposalId: string) {
    const confirmed = confirm("このコンセプトで確定しますか？\n以降 concept_status='locked' に変更され、運用方針が固定されます。");
    if (!confirmed) return;

    const res = await fetch(`/api/accounts/${accountId}/concept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", proposal_id: proposalId }),
    });
    if (res.ok) {
      alert("✅ コンセプトを確定しました");
      load();
    } else {
      alert("エラー: " + (await res.text()));
    }
  }

  async function rejectAll() {
    if (!rejectingFeedback.trim()) {
      alert("フィードバックを入力してください");
      return;
    }
    const res = await fetch(`/api/accounts/${accountId}/concept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", feedback: rejectingFeedback }),
    });
    if (res.ok) {
      alert("差し戻しました。リサーチを再実行します。");
      setShowRejectModal(false);
      setRejectingFeedback("");
      load();
    } else {
      alert("エラー: " + (await res.text()));
    }
  }

  async function retry() {
    const res = await fetch(`/api/accounts/${accountId}/concept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry" }),
    });
    if (res.ok) {
      alert("リサーチを再実行します");
      load();
    }
  }

  if (loading) return <div className="p-6">読み込み中...</div>;
  if (!data) return <div className="p-6">データが見つかりません</div>;

  const statusBadge = STATUS_BADGE[data.account.concept_status] || { label: data.account.concept_status, color: "bg-gray-100" };
  const pendingProposals = data.proposals.filter((p) => p.status === "pending");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{data.account.name}</h1>
        <span className="text-gray-500">&gt;</span>
        <h2 className="text-xl text-gray-700">コンセプト設計</h2>
        <span className={`ml-auto px-3 py-1 rounded-full text-sm ${statusBadge.color}`}>{statusBadge.label}</span>
      </div>

      {/* Locked state: show final concept */}
      {data.account.concept_status === "locked" && data.account.concept_definition && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-green-800 mb-3">✅ 確定コンセプト</h3>
          <div className="space-y-2">
            <div><strong>名前:</strong> {data.account.concept_definition.name}</div>
            <div><strong>手段ズラし:</strong> {data.account.concept_definition.means}</div>
            <div><strong>立場ズラし:</strong> {data.account.concept_definition.position}</div>
            <div><strong>成立理由:</strong> {data.account.concept_definition.reason}</div>
          </div>
          <button onClick={retry} className="mt-4 text-sm text-blue-600 hover:underline">
            🔄 コンセプト再設計
          </button>
        </div>
      )}

      {/* Researching state */}
      {data.account.concept_status === "researching" && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-6 mb-6 text-center">
          <div className="text-blue-800 font-medium">🔵 リサーチ実行中...</div>
          <div className="text-sm text-blue-600 mt-2">Phase A → B → C （2-5分）</div>
        </div>
      )}

      {/* Pending research state */}
      {data.account.concept_status === "pending_research" && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-6 mb-6 text-center">
          <div className="text-yellow-800 font-medium">⏳ リサーチ未実行</div>
          <button onClick={retry} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            🚀 リサーチ開始
          </button>
        </div>
      )}

      {/* Ready for Review: show 3 proposals */}
      {data.account.concept_status === "ready_for_review" && pendingProposals.length > 0 && (
        <>
          {/* Analysis summary */}
          {data.analysis && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-bold mb-2">📊 市場分析サマリー</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600 font-medium">市場の手段（当たり前）:</div>
                  <div>{(data.analysis.common_means || []).slice(0, 5).join(" / ")}</div>
                </div>
                <div>
                  <div className="text-gray-600 font-medium">市場の立場（当たり前）:</div>
                  <div>{(data.analysis.common_positions || []).slice(0, 5).join(" / ")}</div>
                </div>
              </div>
            </div>
          )}

          {/* 3 proposal cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {pendingProposals.map((p) => (
              <div key={p.id} className="border-2 rounded-lg p-4 hover:border-blue-500 transition">
                <div className="text-sm text-gray-500 mb-1">案{p.proposal_rank}: {RANK_LABEL[p.proposal_rank]}</div>
                <h3 className="text-lg font-bold mb-3">{p.concept_name}</h3>

                <div className="space-y-2 text-sm mb-4">
                  <div>
                    <div className="text-gray-600 text-xs">手段ズラし</div>
                    <div>{p.means_shift}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-xs">立場ズラし</div>
                    <div>{p.position_shift}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-xs">奇抜度</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${p.weirdness_score < 5 ? "bg-green-500" : p.weirdness_score < 8 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${p.weirdness_score * 10}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-mono">{p.weirdness_score}/10</span>
                    </div>
                  </div>
                </div>

                {expandedRank === p.proposal_rank ? (
                  <div className="text-sm border-t pt-3 mb-3">
                    <div className="mb-2">
                      <div className="text-gray-600 text-xs mb-1">成立理由</div>
                      <div>{p.establishment_reason}</div>
                    </div>
                    {p.target_reaction_prediction?.positive && (
                      <div className="mb-2">
                        <div className="text-green-700 text-xs mb-1">✅ ポジティブ予測</div>
                        <ul className="list-disc list-inside">
                          {p.target_reaction_prediction.positive.map((x, i) => <li key={i}>{x}</li>)}
                        </ul>
                      </div>
                    )}
                    {p.target_reaction_prediction?.negative && (
                      <div>
                        <div className="text-red-700 text-xs mb-1">⚠️ ネガティブ予測</div>
                        <ul className="list-disc list-inside">
                          {p.target_reaction_prediction.negative.map((x, i) => <li key={i}>{x}</li>)}
                        </ul>
                      </div>
                    )}
                    <button onClick={() => setExpandedRank(null)} className="text-xs text-gray-500 hover:underline mt-2">
                      閉じる
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setExpandedRank(p.proposal_rank)} className="text-xs text-blue-600 hover:underline mb-3">
                    詳細を見る ▼
                  </button>
                )}

                <button
                  onClick={() => approveProposal(p.id)}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                >
                  この案で決定
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setShowRejectModal(true)}
              className="text-sm text-red-600 hover:underline"
            >
              ↻ 3案とも採用せず再生成
            </button>
          </div>
        </>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-3">差し戻してリサーチ再実行</h3>
            <p className="text-sm text-gray-600 mb-3">採用しなかった理由・改善要望を記入してください。次回の生成時に Claude に伝えます。</p>
            <textarea
              value={rejectingFeedback}
              onChange={(e) => setRejectingFeedback(e.target.value)}
              className="w-full border rounded p-2 text-sm h-32"
              placeholder="例: 『理系スピ男子』は似たアカウント既にある。もっと別方向でやり直して"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-gray-600 hover:underline">
                キャンセル
              </button>
              <button onClick={rejectAll} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                送信
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
