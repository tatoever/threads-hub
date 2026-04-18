/**
 * コメント返信の品質チェッカー
 *
 * okitsune-reply-logic.md の NG パターンをコード化。
 * NG検知時は reason リストを返して1回だけリジェネさせる。
 */

export interface QualityCheckResult {
  ok: boolean;
  reasons: string[];
}

export interface QualityCheckOptions {
  maxChars?: number;
  speechLevel?: "casual" | "polite_casual";
  firstPersonToken?: string;   // "俺" | "わたし" | "僕" 等
  firstPersonStrict?: boolean;
  accountProhibitedWords?: string[];
}

export function checkReplyQuality(
  reply: string,
  options: QualityCheckOptions = {}
): QualityCheckResult {
  const reasons: string[] = [];
  const text = reply.trim();
  const maxChars = options.maxChars ?? 100;

  // 1. 長さ
  if (text.length > maxChars) {
    reasons.push(`長すぎる（${text.length}字、上限${maxChars}字）。短く削る。`);
  }
  if (text.length < 10) {
    reasons.push("短すぎる。最低20字程度は欲しい。");
  }

  // 2. em ダッシュ
  if (/[—–]/.test(text)) {
    reasons.push("em ダッシュ（—/–）が含まれている。削除。");
  }

  // 3. 三点リーダー
  if (/…|\.\.\./.test(text)) {
    reasons.push("三点リーダー（…）が含まれている。削除。");
  }

  // 4. 絵文字
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
  if (emojiRe.test(text)) {
    reasons.push("絵文字が含まれている。テキストのみで表現する。");
  }

  // 5. ハッシュタグ
  if (/[#＃]\S+/.test(text)) {
    reasons.push("ハッシュタグが含まれている。削除。");
  }

  // 6. ダブルクォート
  if (/["”“]/.test(text)) {
    reasons.push("ダブルクォートが含まれている。「」カギかっこを使う。");
  }

  // 7. 書き出しの禁止パターン
  const firstLine = text.split("\n")[0];
  const badOpenings = [
    /^おー[、！]/,
    /^お[、ー]/,
    /^おお[、！]/,
    /^あー[、…]/,
    /^確かに/,
    /^なるほど/,
  ];
  if (badOpenings.some((re) => re.test(firstLine))) {
    reasons.push(`書き出し「${firstLine.slice(0, 10)}...」が禁止パターン（おー/確かに/なるほど等）。別の入り方にする。`);
  }

  // 8. 禁止フレーズ
  const bannedPhrases = [
    "面白い組み合わせだね",
    "いい組み合わせだね",
    "重要なのは",
    "興味深いことに",
    "ポイントは",
    "逆に言うと",
    "素晴らしい",
    "ではないでしょうか",
    "送ってくれたんだ",
    "届いてくれたんだ",
    "来てくれたんだ",
    "届くべき人",
    "届くべき場所",
    "必要な人にだけ届く",
    "これ視えてる",
  ];
  for (const phrase of bannedPhrases) {
    if (text.includes(phrase)) {
      reasons.push(`禁止フレーズ「${phrase}」を使用。言い換える。`);
    }
  }

  // 9. 願望否定構文
  const negationPatterns = [
    /じゃなくて/,
    /ではなく(?!て)/,
    /というより/,
  ];
  if (negationPatterns.some((re) => re.test(text))) {
    reasons.push("「〜じゃなくて」「〜ではなく」「〜というより」系の願望否定構文を使用。両立の形に書き換える。");
  }

  // 10. 価値観押しつけ構文
  if (/それが一番|正しいのは|本当は〜/.test(text)) {
    reasons.push("「それが一番〜」「正しいのは〜」「本当は〜」系の価値観押しつけ構文を使用。余白を残す形に。");
  }

  // 11. 占い師口調
  if (/座のあなた/.test(text) || /鑑定結果|運勢は/.test(text)) {
    reasons.push("占い師口調（座のあなた／鑑定結果／運勢は）を使用。自然な口語に。");
  }

  // 12. 丁寧語レベルチェック
  const speechLevel = options.speechLevel || "casual";
  if (speechLevel === "casual") {
    // タメ口キャラで「です・ます」多用はNG
    const desuMasuCount = (text.match(/です[。、！？\n]|ます[。、！？\n]/g) || []).length;
    if (desuMasuCount >= 2) {
      reasons.push(`タメ口キャラなのに「です／ます」が${desuMasuCount}箇所。砕いた口調にする。`);
    }
  }

  // 13. 一人称チェック（strict モード）
  if (options.firstPersonStrict && options.firstPersonToken) {
    const otherFirstPersons = ["私", "俺", "僕", "わたし", "あたし", "ワイ", "自分"].filter(
      (t) => t !== options.firstPersonToken
    );
    for (const fp of otherFirstPersons) {
      const re = new RegExp(`(^|[^一-龯ぁ-んァ-ヶー])${fp}(?!語|人|有|分|由)`);
      if (re.test(text)) {
        reasons.push(`一人称「${fp}」を使用。このキャラの一人称は「${options.firstPersonToken}」のみ。`);
        break;
      }
    }
  }

  // 14. アカウント固有の禁止語
  for (const word of options.accountProhibitedWords || []) {
    if (text.includes(word)) {
      reasons.push(`アカウント固有の禁止語「${word}」を使用。言い換える。`);
    }
  }

  // 15. 評価語彙（上から目線）
  const evaluative = ["えらい", "立派", "素晴らしい", "ちゃんと"];
  for (const word of evaluative) {
    if (text.includes(word)) {
      reasons.push(`評価語彙「${word}」を使用。peer register（仲間目線）崩れ。自己開示や並列共感に書き換える。`);
    }
  }

  // 16. 採点語（断定）
  if (/合ってる|合ってます|正しい(?!のは)/.test(text)) {
    reasons.push("採点語（合ってる／正しい）を使用。断定せず「〜かもしれない」「〜だったりする」等の余白に書き換える。");
  }

  // 17. 命令形の連打
  const commandPatterns = [/してみ[てろ]?[。！、 ]/g, /やってみ[てろ]?[。！、 ]/g, /しな[。！、 ]/g];
  const commandCount = commandPatterns.reduce(
    (sum, re) => sum + (text.match(re) || []).length,
    0
  );
  if (commandCount >= 2) {
    reasons.push(`命令形（〜してみ／やってみ／〜しな）が${commandCount}回。1回以下に抑えて、提案形（〜するといいよ／〜でいいと思う）に寄せる。`);
  }

  // 18. 接続詞連打
  const connectors = ["さらに", "また", "加えて", "その上"];
  const connectorCount = connectors.reduce(
    (sum, c) => sum + (text.match(new RegExp(c, "g")) || []).length,
    0
  );
  if (connectorCount >= 2) {
    reasons.push(`接続詞（さらに／また／加えて／その上）が${connectorCount}回。1回までに抑える。`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export function formatReasonsForRegen(reasons: string[]): string {
  return reasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
}
