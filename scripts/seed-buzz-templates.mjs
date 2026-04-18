import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const templates = [
  {
    code: 'selective',
    name: '選民フック',
    description: '読者を「特別な存在」としてセレクトする心理的前振りで手を止める。強い祝福で終わるので読後感ポジティブ、シェアされやすい。',
    length_hint: '50-100',
    tags: ['短文', '単発', '強呼びかけ'],
    prompt_body: `【型: 選民フック】
読者を「特別な存在」としてセレクトする心理的前振りで手を止める。

構造:
1行目: 読者が「自分のこと？」と感じる選民宣言
  - 「〜に見えてる人」「〜な人だけ」「〜している人」など対象を限定
  - 断言形（「〜らしいよ」「〜だけに届く」）で確信感を出す
空行を入れて呼吸を作る
2ブロック目: その読者への祝福・応援・予言
  - 「絶対〜」「〜ますよ」「〜するから」の断言形
  - 押しつけ感は出さない

文字数: main 50-100字。reply なし。
改行: 1行15-25字、意味単位で改行
絵文字: 使うなら1個だけ（🌸🌙✨など意味のあるもの）
NG: 「いかがでしょうか」「〜と思います」の弱い語尾、押しつけ説教`,
    avg_engagement: { likes_min: 1000, likes_max: 2500, sample: 'IMG_4003 2347 likes' },
    example_refs: { screenshots: ['IMG_4003', 'IMG_4042', 'IMG_4043', 'IMG_4011'] },
  },

  {
    code: 'prophecy',
    name: '予言断言',
    description: '読者に起こる良いことを具体的に言い切って希望と信頼を作る。数字を入れるほど説得力が増す。',
    length_hint: '60-120',
    tags: ['中文', '単発/ツリー可', '強断言'],
    requires_cta_type: null,
    prompt_body: `【型: 予言断言】
読者に起こる良いことを具体的に言い切って希望と信頼を作る。

構造:
1行目: 状況特定 or 前置き
  - 「〜なあなたへ」「〜している人」で対象設定
  - または「正直言うと」「たぶん」「すみません、正直に言いますが」
2行目: 具体的な予言内容
  - 数字を入れる（「30万の臨時収入」「3日以内に」「1週間で」）
  - 「〜ますよ」「〜します」の断定形
  - 「かもしれません」「〜と思います」禁止
3ブロック目: 読者を次アクションに導く（絵文字コメ誘導 or reply続き）

文字数: main 60-120字。ツリーの場合 reply_1 で詳細展開
cliff-hanger: ツリー使うなら main 最後を「お話しします。」等で締めて reply_1 で具体内容
絵文字: 🌸🌙☀などの象徴1個
NG: 曖昧な「〜かもしれない」「〜な気がする」、AI臭「いかがでしょうか」`,
    avg_engagement: { likes_min: 200, likes_max: 6500, sample: 'IMG_4046 6193 likes' },
    example_refs: { screenshots: ['IMG_4046', 'IMG_4004'] },
  },

  {
    code: 'empathy_short',
    name: '超短文共感',
    description: '30-80字の超短文で強い共感 or 議論喚起。Threads王道のバズパターン、最高9,673いいね。',
    length_hint: '30-80',
    tags: ['超短文', '単発', '軽語尾', 'バズ率高'],
    prompt_body: `【型: 超短文共感】
30-80字の超短文で強い共感 or 議論喚起。Threads文化の王道バズパターン。

構造:
全1ブロック・40-80字程度
  - 問いかけ形: 「〜てない？」「〜やろ？」「〜な気がする」
  - 断言+笑: 文末に「笑」で軽さ
  - 世代・性別・職業など属性を名指し（「女って」「30代が」「ママって」）
  - 具体の手段・理論を書かない。感覚だけを投げる

文字数: main 30-80字。reply は絶対に使わない（短さが命）
改行: 1-2行。1メッセージ=1投稿
意識: "深い考察" より "一言で共感を呼ぶ" を最優先。長く書かない勇気
絵文字: なし推奨、あっても1個
NG: 長文、箇条書き、補足説明、解説`,
    avg_engagement: { likes_min: 500, likes_max: 9700, sample: 'IMG_4005 9673 likes' },
    example_refs: { screenshots: ['IMG_4005', 'IMG_4013'] },
  },

  {
    code: 'surreal_source',
    name: '非現実ソース',
    description: '語り手自身の意見ではなく、人外/第三者の口を借りて託宣風に言う。説得感・神秘感が上がる。',
    length_hint: '60-120',
    tags: ['中文', 'ツリー推奨', '託宣風'],
    prompt_body: `【型: 非現実ソース】
語り手自身の意見ではなく、人外/第三者の口を借りて託宣風に言う。「私が言ってる」より説得感・神秘感が出る。

構造:
1行目: 情報源の明示
  - 人外系: 妖精、ご先祖様、守護霊、神様、カード、星、月
  - 第三者系: 弟、祖母、友人、先生、姉、常連さん
  - 「〜から聞いたんですが」「〜がさっき言った」「〜が教えてくれた」
2行目以降: その情報源の言葉を伝える（予言・助言・真実）
  - 直接話法（「〜って」「〜だよ」）で生っぽさを出す

文字数: main 60-120字、reply_1 で詳細（ツリー可）
cliff-hanger: 「〜の特徴はね、」「〜の続きはね、」で reply 期待を作る
絵文字: 象徴ひとつ（🌙 ご先祖、🧚 妖精、🔮 占い系）
NG: 「〜と言われています」の権威感、情報源なしの押しつけ`,
    avg_engagement: { likes_min: 400, likes_max: 1500, sample: 'IMG_4006 421 / IMG_4042 1460' },
    example_refs: { screenshots: ['IMG_4006', 'IMG_4009', 'IMG_4042'] },
  },

  {
    code: 'grandma_wisdom',
    name: '諭し（親族格言）',
    description: '自分の説教ではなく、親族や先達の格言を通して教訓を伝える。説教臭さが消えエモさが乗る。',
    length_hint: '80-130',
    tags: ['中文', 'ツリー可', 'エモ系'],
    prompt_body: `【型: 諭し（親族格言）】
自分の説教ではなく、親族や先達の格言を通して教訓を伝える。説教臭さが消え、エモさが乗る。

構造:
1行目: 読者への問いかけ or 状況設定
  - 「〜な人、いますか？」「〜してる瞬間、あるよね」
2行目以降: 引用元の存在と言葉
  - 「祖母がよく言っていた。」「父親がぽつっと言った。」「元上司が教えてくれた。」
  - 引用「」の中に短い格言（15-30字の言い回し）
余韻: 文末を「、、、」「今でも覚えてる。」「ずっと残っている」で締める

文字数: main 80-130字、reply_1 で補足（ツリー可）
改行: 1メッセージ=1-2行。引用文は独立させる
cliff-hanger: 「、、、」で余韻を残して reply で結論・現代解釈
絵文字: ほぼ使わない（シンプルさが価値）
NG: 上から目線の説教、長い独白、複数格言の羅列`,
    avg_engagement: { likes_min: 500, likes_max: 6500, sample: 'IMG_4041 6015 likes' },
    example_refs: { screenshots: ['IMG_4041', 'IMG_4007'] },
  },

  {
    code: 'confrontation',
    name: '告発→救済',
    description: '困った人タイプを指して被害者に共感し、「でも」で希望/対策に反転してツリーに誘導。',
    length_hint: '60-100',
    tags: ['中文', 'ツリー必須', 'cliff-hanger'],
    prompt_body: `【型: 告発→救済】
困った人タイプを指して被害者に共感。その後「でも」で希望/対策に反転してツリーに誘導。

構造:
1行目: 困った人タイプの具体描写
  - 「〜しておいて、〜する人」「〜なふりして〜な人」
  - 行動パターンを具体的に（抽象的な性格NG）
2行目: 「いるよね。」の一言で読者を味方につける
3行目: 「でもね、」「でも実はね、」で希望/反転に入る ← ここが cliff-hanger

文字数: main 60-100字。reply_1 で救済内容（ツリー必須）
改行: 1行15-25字。「いるよね。」は独立行
cliff-hanger: main は「でもね、」で切る。続きを reply で必ず書く
絵文字: なし推奨
NG: 「でもね、」で切らずに救済まで書き切る（それだと普通の解説投稿）`,
    avg_engagement: { likes_min: 500, likes_max: 1500, sample: 'IMG_4010 1082 likes' },
    example_refs: { screenshots: ['IMG_4010'] },
  },

  {
    code: 'comment_hook',
    name: 'コメ誘導ギミック',
    description: 'コメ欄に特定の絵文字/ワードを置いてもらう型。コメ率が極端に高くなる（時にコメ数>いいね数）。',
    length_hint: '100-150',
    tags: ['中文', 'コメ爆増', '要個別返信体制'],
    prompt_body: `【型: コメ誘導ギミック】
コメント欄に特定の絵文字/ワードを置いてもらうことで、返信と対話を爆増させる型。コメ率が極端に高くなる（いいね数 > コメ数 も起こる）。

構造:
1行目: 提供する価値の紹介
  - 「〜を視てもらいたい人いますか？」
  - 「〜な人、必要な言葉伝えます」
2-3行目: 具体的な提供内容（なぜそれができるか、限定条件など）
最終行: 行動指示「〜と置いていってくれた人に〜」
  - 絵文字単体（🌙 ☀ 🌸 ✨ 🔮）
  - 特定ワード（「見て」「はい」など）

文字数: main 100-150字。reply は後で個別返信として展開される想定
改行: 1行15-25字。行動指示は独立段落に
絵文字: 誘導用の象徴1個を明記（「〇〇を置いてね」）
NG: 複数絵文字を選択肢にする（混乱）、返信できない規模の呼びかけ
適用条件: ユーザーが個別返信する運用体制がある時だけ使う（無責任な呼びかけ禁止）`,
    avg_engagement: { likes_min: 100, likes_max: 300, comment_ratio: 'very_high', sample: 'IMG_4012 108 likes / 191 comments' },
    example_refs: { screenshots: ['IMG_4012', 'IMG_4004'] },
  },

  {
    code: 'declaration',
    name: 'キャラ宣言',
    description: 'キャラが自称で「本気出します」と宣言、フォロワーへのコミットを明示。ファン化促進。',
    length_hint: '100-150',
    tags: ['中文', 'ファン化', 'キャラ名自称'],
    prompt_body: `【型: キャラ宣言】
キャラが自分の名前で「本気出します」「動きます」と宣言し、フォロワーへのコミットを明示。ファン化を促進する型。

構造:
1行目: 宣言の前置き
  - 「おまたせしました」「正直に言うと」「そろそろ」
  - キャラ名を自称（三人称セルフ呼び）すると強度UP
2行目: フォロワーへの約束
  - 「〜を動いていく」「〜のために〜する」
3行目: 現読者（この投稿を見てる人）への祝福/ラッキー宣言
  - 「フォローできてる人は既に〜」「見えてる人はラッキー」

文字数: main 100-150字。reply 通常なし
改行: 意味ブロックで段落分け
絵文字: なし or 控えめ1個
キャラ名: 自称（三人称）で書くことが効果的。「○○は〜します」スタイル
NG: 上から目線の押しつけ、根拠のない大風呂敷`,
    avg_engagement: { likes_min: 1000, likes_max: 2000, sample: 'IMG_4040 1461 likes' },
    example_refs: { screenshots: ['IMG_4040'] },
  },

  {
    code: 'before_after_contrast',
    name: '対比リスト',
    description: '「前者/後者」「Aタイプ/Bタイプ」の対比を使って気づきを与える。経験談から入ると生っぽい。',
    length_hint: '120-180 + reply',
    tags: ['長文ツリー', '対比', '経験談'],
    prompt_body: `【型: 対比リスト】
「前者/後者」「Aタイプ/Bタイプ」の対比を使って読者に気づきを与える。経験談・観察談から入ると生っぽい。

構造:
1行目: 経験談の導入
  - 「〜だった頃」「〜で働いてた時」「〜していた時期」
2行目: 2タイプの定義
  - 「〜する女/〜する女」「〜な人/〜な人」
  - カギカッコ「」で強調すると読ませやすい
3行目: 前者の特徴を言い切る
4行目: 「後者は、」で切って reply に送る（cliff-hanger）
reply_1: 後者の特徴を具体的に。最後にまとめ or 教訓

文字数: main 120-180字、reply_1 100-150字（ツリー必須）
改行: 1行15-25字。対比ペアは独立段落に
cliff-hanger: 「後者は、」で文字通り切る。「後者は○○である。」と書き切らない
NG: 対比が抽象的（「良い人/悪い人」）、経験談なしで観察だけ`,
    avg_engagement: { likes_min: 400, likes_max: 800, sample: 'IMG_4008 583 likes' },
    example_refs: { screenshots: ['IMG_4008'] },
  },
];

// Upsert
for (const t of templates) {
  const { data: existing } = await sb.from('buzz_templates').select('id').eq('code', t.code).maybeSingle();
  if (existing) {
    const { error } = await sb.from('buzz_templates').update(t).eq('id', existing.id);
    console.log(`UPDATE ${t.code}`, error ? `FAIL: ${error.message}` : 'ok');
  } else {
    const { error } = await sb.from('buzz_templates').insert(t);
    console.log(`INSERT ${t.code}`, error ? `FAIL: ${error.message}` : 'ok');
  }
}

const { data: all } = await sb.from('buzz_templates').select('code,name,is_active').order('code');
console.log(`\n=== 登録済みテンプレ (${all.length}) ===`);
for (const t of all) console.log(`  [${t.is_active ? 'ON' : 'OFF'}] ${t.code}  ${t.name}`);
