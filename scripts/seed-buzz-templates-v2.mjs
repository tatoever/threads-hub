import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 新規追加3型 + 既存型の tag更新/軽い補強
const templates = [
  {
    code: 'story_real',
    name: 'リアル体験エピソード',
    description: '感情が動いた瞬間の具体的な時間・場所・五感を描写する記憶定着型。抽象論ではなく「あの日あの場所」の一人称エピソード。',
    length_hint: '100-180 + optional tree',
    tags: ['中文', '一人称', '記憶定着', 'エモ系'],
    prompt_body: `【型: story_real（リアル体験エピソード）】
感情が動いた瞬間の具体を一人称で描く。読者の脳に「あの日あの場所」として記憶させる型。
抽象論や教訓ではなく、そのシーンにいたかのように再現することで信頼感を作る。

構造:
1行目: そのシーンの入り口。時間 + 場所 + 一個の具体（フック6パターンのCまたはEが相性◎）
  - 「土曜の朝7時、まだ誰も起きてないリビングで、」
  - 「保育園のお迎え帰り、車の中でふと、」
  - 「3日前の夜、寝る前にスマホ見てたら、」

2行目以降: 五感を1つ以上入れる
  - 視覚: 「月明かりが窓枠から斜めに差してて」
  - 聴覚: 「換気扇の音だけしてる台所で」
  - 触覚: 「冷たいフローリングに足つけたら」
  - 味覚: 「冷めたコーヒーを口に含んだら」
  - 嗅覚: 「洗濯物の柔軟剤の匂いがふっときて」

終盤: その時に気づいたこと/感じたこと を 一文で。説教しない。

文字数: main 100-180。ツリー不要が基本。200字超えるなら reply_1 に続き。
NG: 「〜な経験をしました」の報告調、抽象的総括、persona.background にない経歴の偽造
必須: 時間・場所・五感のどれか3つ
フック推奨: C実況型 or E数字型（「3日前の夜」等）
頻度: 1日1本程度（エモ系は連発すると薄まる）`,
    avg_engagement: { note: '記憶定着型のため、いいね数よりコメントとシェアで成果が出る' },
    example_refs: { source: 'SNS_Jin/Knowledge/threads_post_6types.md（型4）' },
    is_active: true,
  },

  {
    code: 'norm_breaker',
    name: '常識破壊型',
    description: '市場の当たり前を否定してから代替案を示す。「○○が大事って言われてるけど、実は逆」で読者の前提を揺さぶる。',
    length_hint: '80-150',
    tags: ['短文', '単発', '逆張り', '議論喚起'],
    prompt_body: `【型: norm_breaker（常識破壊型）】
市場の通俗観・当たり前をひっくり返して、代替の真理を提示する型。
議論が起きやすいのでコメントも伸びるが、炎上には細心の注意。

構造:
1行目: 常識の提示 + 否定（フック6パターンのAまたはFが相性◎）
  - 「〇〇が大事って言うけど、実は逆」
  - 「みんな〇〇って言うよね。でもね、」
  - 「〇〇より△△の方がずっと効く」

2行目以降: 否定の理由を体感ベースで語る
  - 理論や統計より、自分/キャラの体感・観察
  - 「なぜそれが逆なのか」を短く説明

3行目: 代替案 or 新しい視点の提示
  - 読者が「あ、そういうことか」と気づく一文

文字数: main 80-150字。短く刺す。
NG: 他人や他の考えを見下した言い方、攻撃的なトーン、抽象論だけ
必須: 具体的な代替案（「〇〇の代わりに△△」）
フック推奨: A断言型 or F対比型
頻度: 1日1本まで（連発すると炎上リスク）`,
    avg_engagement: { note: '議論喚起型。コメント率高く、リポストも期待できる' },
    example_refs: { source: 'SNS_Jin/Knowledge/threads_post_6types.md（型5）' },
    is_active: true,
  },

  {
    code: 'teaser_tree',
    name: '情報小出しツリー',
    description: '3分割ツリーで情報を小出しにして、各 reply 末尾に cliff-hanger を仕込む。全体で読者を引っ張り続ける型。',
    length_hint: 'tree_150+150+150',
    tags: ['ツリー必須', '3分割', '情報小出し', 'cliff-hanger'],
    prompt_body: `【型: teaser_tree（情報小出しツリー）】
3分割ツリーで情報を小出しにし、各 reply 末尾で必ず次への引きを作る。
読者が「続きが気になる」状態を最後まで維持する設計。

構造:
[main] 150-180字: 問題提起 + 核心の匂わせ
  - フック → 何についての話か明示 → 「説明すると、」で reply_1 に送る
  - ここで答えは出さない

[reply_1] 150-180字: 核心の半分だけ見せる
  - 3つあるなら2つだけ、5ステップあるなら3までだけ等
  - 末尾で「ただ、やっちゃダメなことが一つあって、」or「実はこの後が一番大事で、」で reply_2 に送る

[reply_2] 100-150字: 残り + 最後の落とし
  - 残りの情報を出す
  - 最後に軽い行動喚起 or 問いかけ

cliff-hanger必須パターン（main末/reply_1末のどこかで使う）:
- 「〇〇のことか説明すると、」
- 「ただやっちゃダメなことがあって、」
- 「実はこの先が一番大事で、」
- 「でもね、」
- 「その続きはね、」

文字数: 各 150-180字。1投稿完結型を絶対に作らない。
NG: main だけで話が完結すること（teaser の意味がなくなる）、抽象スピワード、情報提示だけで終わる
頻度: 1日1-2本。連発するとツリー疲れを起こす`,
    avg_engagement: { note: 'ツリー3分割の滞在時間長い。フォロー動機が生成されやすい' },
    example_refs: { source: 'SNS_Jin/Knowledge/参考分析_ツリー型投稿_koshiroganemio.md' },
    is_active: true,
  },
];

// Upsert
for (const t of templates) {
  const { data: existing } = await sb.from('buzz_templates').select('id').eq('code', t.code).maybeSingle();
  if (existing) {
    const { error } = await sb.from('buzz_templates').update(t).eq('id', existing.id);
    console.log(`UPDATE ${t.code}:`, error?.message || 'ok');
  } else {
    const { error } = await sb.from('buzz_templates').insert(t);
    console.log(`INSERT ${t.code}:`, error?.message || 'ok');
  }
}

const { data: all } = await sb.from('buzz_templates').select('code,name,requires_cta_type').order('code');
console.log(`\n=== 全テンプレ (${all.length}) ===`);
for (const t of all) console.log(`  ${t.code.padEnd(25)} ${t.name}${t.requires_cta_type ? ' [CTA]' : ''}`);
