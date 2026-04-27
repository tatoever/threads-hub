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
  /** 本日が休日(土日+祝日) か平日か。true=休日、false=平日、undefined=判定スキップ */
  isOffDay?: boolean;
  /** 表示用の曜日ラベル（エラーメッセージに使用） */
  dayOfWeekJa?: string;
  /**
   * 生成種別のコンテキスト
   * - comment_reply (default): コメント返信（reply.ts から呼ばれる用途）
   * - single: 単発投稿（投稿生成側）
   * - tree_main / tree_reply_1: ツリー型 投稿の中間ノード（cliff-hanger 許容）
   * - tree_reply_2: ツリー型 投稿の最終ノード（句点必須）
   */
  contextType?: "comment_reply" | "single" | "tree_main" | "tree_reply_1" | "tree_reply_2";
  /**
   * コメンターの温度感（reply 用）
   * - formal の場合、speech_level=casual キャラでも敬体混入を許容
   *   (年配・丁寧語のコメンターに対する社会的に自然な対応)
   */
  commenterTone?: "casual" | "mid" | "formal";
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
  // 副次発見対応 (2026-04-25): commenterTone='formal' の場合、casual キャラでも敬体混入を許容
  // 例: 義母など年配コメンターの丁寧コメントに敬体で返すのは社会的に自然
  const speechLevel = options.speechLevel || "casual";
  const commenterTone = options.commenterTone;
  if (speechLevel === "casual" && commenterTone !== "formal") {
    // タメ口キャラで「です・ます」多用はNG (相手がformalなら許容)
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

  // 18. 曜日ミスマッチ検知（JST 当日が休日 or 平日に対して不整合な語彙）
  if (options.isOffDay === true) {
    const weekdayOnlyPatterns = [
      "保育園", "幼稚園", "小学校", "登校", "登園", "送り届",
      "出勤", "退勤", "通勤", "職場", "会議", "ミーティング",
      "月曜の朝", "月曜から", "火曜", "水曜", "木曜", "金曜",
      "ランチタイム", "昼休み", "給湯室", "打ち合わせ",
    ];
    for (const w of weekdayOnlyPatterns) {
      if (text.includes(w)) {
        reasons.push(`本日(${options.dayOfWeekJa || "休日"})は休日だが、平日専用語彙「${w}」を使用。休日に整合する表現に書き換える。`);
        break;
      }
    }
  } else if (options.isOffDay === false) {
    const weekendOnlyPatterns = [
      "休日の朝", "週末気分", "今日は休み", "家で1日ゴロゴロ",
    ];
    for (const w of weekendOnlyPatterns) {
      if (text.includes(w)) {
        reasons.push(`本日は平日だが、休日専用語彙「${w}」を使用。平日に整合する表現に書き換える。`);
        break;
      }
    }
  }

  // 19. 接続詞連打
  const connectors = ["さらに", "また", "加えて", "その上"];
  const connectorCount = connectors.reduce(
    (sum, c) => sum + (text.match(new RegExp(c, "g")) || []).length,
    0
  );
  if (connectorCount >= 2) {
    reasons.push(`接続詞（さらに／また／加えて／その上）が${connectorCount}回。1回までに抑える。`);
  }

  // 20. 文末の句点ルール
  // SNS口語でも、返信の最後の1文は「。」で閉じる。
  // 例外1: ？ ！ で終わる疑問/感嘆、または引用符で閉じる場合
  // 例外2 (Q1対応 2026-04-25): tree_main / tree_reply_1 はツリー設計上「、」「、、、」で
  //   次に引きを作るのが正常 → このコンテキストでは句点ガードをスキップ
  const lastChar = text.slice(-1);
  const validEndings = ["。", "？", "！", "?", "!", "」", "）", ")", "笑"];
  const ctx = options.contextType;
  const isTreeMiddle = ctx === "tree_main" || ctx === "tree_reply_1";
  if (!isTreeMiddle && text.length > 0 && !validEndings.includes(lastChar)) {
    reasons.push(
      `文末が句読記号で閉じられていない（最後の文字: 「${lastChar}」）。文末には必ず「。」を付けて閉じる。SNS口語でも句点は省略しない。`
    );
  }

  // 21. 「、が〜で。」の不自然な節連結
  // 例: 「先に手放す、が9のセオリーで。」→「先に手放すのが9のセオリー。」
  if (/、が[^、。]{2,20}で[。？！?!]/.test(text)) {
    reasons.push(
      "「、が〜で。」の不自然な節連結を検出。「〜のが〜」に書き換え、「〜で。」で終止せず「〜だ。/〜です。/〜。」で閉じる。"
    );
  }

  // 22. 連用形「〜で。」終止
  // 「〜で。」で止めるのは中途半端。「〜だ。」「〜です。」「〜。」にする
  // ただし「〜ので。」「〜まで。」「〜から。」等は許容
  if (/[^のまかくへ]で[。]$/.test(text)) {
    reasons.push(
      "連用形「〜で。」で文が終止している。「〜だ。/〜です。/〜。」の終止形で閉じる。"
    );
  }

  // 23. コメンターの書き方をメタに論評する癖（再設計版 2026-04-25）
  // 旧ロジックは「引用+共感」型「『〜』、その言葉に〜」も誤検知してたので、
  // 「装飾要素 (target)」+「動作動詞 (verb)」+「評価語 (eval)」の3要素のうち
  // 2つ以上が30字以内に共起した時のみメタ論評と判定
  const META_TARGET = /(「[笑ｗw！!?？]」|絵文字|顔文字|スタンプ|語尾|句読点|改行|文体|書き方|つけ方|入れ方)/;
  const META_VERB = /(つけ(?:て|る|た|てる)|書い(?:て|た)|使っ(?:て|た)|入れ(?:て|た)|込め(?:て|た))/;
  const META_EVAL = /(いい|正直|印象的|かわい|素敵|気持ち|センス|うまい|ぐっとくる|好き)/;
  const targetMatch = text.match(META_TARGET);
  if (targetMatch && typeof targetMatch.index === "number") {
    const idx = targetMatch.index;
    const around = text.slice(Math.max(0, idx - 30), idx + targetMatch[0].length + 30);
    const hasVerb = META_VERB.test(around);
    const hasEval = META_EVAL.test(around);
    // 装飾要素+動詞+評価 が同時 → メタ論評
    if (hasVerb && hasEval) {
      reasons.push(
        "コメンターの『笑』『絵文字』『語尾』等の表現方法を論評している。相手の書き方は受け取るだけで、自分から評論しない。"
      );
    }
  }
  // 旧ロジックの "「.+」って(つけ|書い)" も装飾要素+動詞のセットなのでここで併せて検知
  if (/「[^」]+」って(つけて|書い|入れて|使って)(る|た|てる)?/.test(text)) {
    reasons.push("「『〜』ってつけて/書いて/使って」型のメタ論評を検出。相手の書き方の論評はしない。");
  }

  // 24. 「、、」以上の連続読点（三点リーダ代用のAI臭）
  // Q1/Q3対応 (2026-04-25): tree_main / tree_reply_1 末尾1箇所のみ許容
  //   それ以外（複数箇所、文中、コメント返信、tree_reply_2、single）は一律NG
  const tripleCommaMatches = [...text.matchAll(/、{2,}/g)];
  if (tripleCommaMatches.length > 0) {
    const onlyAtEndOfTreeMiddle =
      isTreeMiddle &&
      tripleCommaMatches.length === 1 &&
      (tripleCommaMatches[0].index ?? 0) + tripleCommaMatches[0][0].length >= text.length - 1;
    if (!onlyAtEndOfTreeMiddle) {
      reasons.push(
        "「、、」以上の連続読点を検出（三点リーダ代用のAI臭パターン）。読点で間を作らず、句点や改行で表現する。"
      );
    }
  }

  // 25. 不完全な文末（動詞語幹切れ）
  // 例: 「二度寝してい。」「考えてい。」「やってき。」のような語幹切れ
  // ホワイトリスト: 形容詞・名詞で正常に終わる末尾は除外
  const VALID_VERB_TAIL = /(した|して(?:る|た|ます)?|きた|きて|なった|なって|あった|あって|いた|いて|くる|くれた|くれて|だった|だ|である|です|ます|ました|ません|ない|なく|たい|たくて|そう|よう|べき|わ|よ|ね|の|から|けど|のに|のだ|んだ|わけ|はず|つもり)。?$/;
  const SAFE_NOUN_ADJ = /(ない|たい|らしい|ほしい|きれい|うれしい|かなしい|あたたかい|つめたい|やさしい|はずかしい|もう|いま|きょう|あした|わたし|きみ|あなた|きもち|なみだ|こころ|ことば|あさ|ひる|よる|つき|ほし|ひと|いえ|まち|みち|かぜ|あめ|ゆき|はな|き|ね|よ|わ|の|か|さ)。?$/;
  const SUSPICIOUS_TAIL = /[ぁ-ん]{1,2}。$/;
  if (SUSPICIOUS_TAIL.test(text) && !VALID_VERB_TAIL.test(text) && !SAFE_NOUN_ADJ.test(text)) {
    const tail = text.slice(-3);
    reasons.push(`不完全な文末の疑い: 「${tail}」(動詞語幹切れ・生成事故の可能性)`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export function formatReasonsForRegen(reasons: string[]): string {
  return reasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
}
