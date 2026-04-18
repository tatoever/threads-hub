import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const template = {
  code: 'cta_drive',
  name: 'CTA深掘り誘導（ティーザー型）',
  description: 'Threadsの本文ではティーザーとして核心の気づきを置き、詳細・検証・応用・ストーリーを note に送る設計。クリック動機を本文内で構築する。',
  length_hint: 'tree_cta_optimized',
  tags: ['CTA専用', 'ツリー必須', 'コピーライティング強', '夜帯推奨'],
  requires_cta_type: 'note_url',
  cta_placement: 'reply_tree_tail',
  prompt_body: `【型: cta_drive（note深掘り誘導）】
Threadsの本文では"ティーザー"として最も重要な1つの気づきを置き、詳細・検証・応用・ストーリーを note に送る設計。読者がクリックする動機を本文内に構築する。

構造:
[main] ティーザー 80-150字
  - フック1行目で読者の体験/本音を突く
  - 答えを完結させない。「ここでは触れないけど」「本当にヤバい部分は」の空白を残す
  - ただし曖昧すぎず、読者が"なんの話か"は明確に
  - main末尾は cliff-hanger で reply に送る

[reply_1] リード 150-200字
  - Threads で出せる範囲の最大限
  - まだ note は出さない。実践手順の"最初の一かけら"だけ渡す
  - 読者が「これだけでも価値ある」と思える情報量
  - 同時に「本編はもっと濃い」と感じさせる余白を残す

[reply_2] CTA 80-120字
  - URL貼る前に、そのクリックで得られる具体ベネフィットを必ず1行入れる
  - キャラ自身の言葉で、なぜクリックすべきかを語る
  - 「note で続き」「プロフから」「詳しくは」の業者フレーズは絶対使わない

クリック誘発の3要素（どれか1つ以上を必ず含む）:
1. ベネフィット: 読んだ後の体感変化を具体的に言語化
2. 限定性: 「ここでは書けない本音」「noteだけの補足」「実はもう一個ある」
3. 具体性: 所要時間、ステップ数、体験者数、失敗パターン集、検証メモ

NGフレーズ（絶対使用禁止）:
- 「詳しくはnoteに」
- 「続きはプロフのリンクから」
- 「もっと知りたい人はnote」
- 「プロフにリンク貼ってます」
- 「noteを書きました」「note書いてます」
- 「興味ある人は」

OKフレーズの方向性（※キャラが自力で生成、丸パクリ禁止）:
- 「これを3週間続けた時の検証メモ、失敗した2週目の話含めて note に残してる」
- 「ここでは書けなかった本音の部分、noteに置いてる。10人に試した結果と共通点もある」
- 「5分で読めるけど今夜の睡眠が変わるメモ」
- 「同じ悩みで3年迷走した記録。これからやる人が回り道しないように」

単発禁止: 必ず3連ツリー（main + reply_1 + reply_2）で出力
配置意図: 夜（20:00以降）帯が相性良い — 本文で心が動いた状態で note へ
頻度: 1日最大2本（他スロットは共感/教育型に任せる）`,
  example_refs: { note: '実データではなく、16枚スクショから抽出した誘導パターン + コピーライティング理論に基づく設計' },
  avg_engagement: { note: 'CTA専用型のため note クリック率が KPI。エンゲージメント自体は共感型より低めでも可' },
  is_active: true,
};

const { data: existing } = await sb.from('buzz_templates').select('id').eq('code', template.code).maybeSingle();
if (existing) {
  const { error } = await sb.from('buzz_templates').update(template).eq('id', existing.id);
  console.log('UPDATE cta_drive:', error?.message || 'ok');
} else {
  const { error } = await sb.from('buzz_templates').insert(template);
  console.log('INSERT cta_drive:', error?.message || 'ok');
}

const { data: all } = await sb.from('buzz_templates').select('code,requires_cta_type').order('code');
console.log(`\n=== 全テンプレ (${all.length}) ===`);
for (const t of all) console.log(`  ${t.code}${t.requires_cta_type ? ' [requires: ' + t.requires_cta_type + ']' : ''}`);
