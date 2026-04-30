/**
 * 凍結事案 緊急対応 E1+E3+E4+E5
 *   E1: diagnostic_tree 無効化 + meeting プロンプトに NG パターン
 *   E3: 10アカ profile_bio を中立化
 *   E4: fukurou/kawauso daily_post_target=5
 *   E5: 10アカ prohibited_words に ryunosuke 系 NG ワード追加
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// === E1: diagnostic_tree 無効化 ===
console.log('\n=== E1: diagnostic_tree 無効化 ===');
const { error: e1 } = await sb.from('buzz_templates').update({ is_active: false }).eq('code', 'diagnostic_tree');
if (e1) console.error('E1 err', e1);
else console.log('[OK] diagnostic_tree → is_active=false');

// E1 続: meeting プロンプトに NG パターン追記
console.log('\n=== E1: meeting prompt に「N タイプ診断」NG 追記 ===');
const NG_DIAGNOSTIC_PATTERN = `

## 🚫 緊急 (2026-04-28): 診断テンプレ全廃
以下のパターンは絶対に slot に含めない (凍結事案により):
- 「N タイプに分かれる」「3タイプに分かれる」「だいたい3タイプ」
- 「BとCも書くね」「BとCも続けるね」
- 「最後にそれぞれの扱い方置いておく」
- 「あなたはどれタイプだった？」「どれタイプ？コメントで教えて」
- 「Aタイプは〜 Bタイプは〜 Cタイプは〜」の診断構造そのもの
- buzz_template_code に diagnostic_tree を選ぶこと
これらは Threads アルゴリズムで「テンプレ生成 bot 群クラスタ」と判定される因子。
代わりに具体エピソード型 (story_real, chronicle_tree)、共感型 (empathy_short)、
問いかけ型 (question_chain_tree) を選ぶこと。`;

const { data: prompts } = await sb.from('account_prompts').select('id, system_prompt').eq('phase', 'meeting');
let promptUpdated = 0;
for (const p of prompts ?? []) {
  if (p.system_prompt.includes('診断テンプレ全廃')) continue; // 既に追記済み
  const newPrompt = p.system_prompt + NG_DIAGNOSTIC_PATTERN;
  await sb.from('account_prompts').update({ system_prompt: newPrompt }).eq('id', p.id);
  promptUpdated++;
}
console.log(`[OK] meeting prompts updated: ${promptUpdated}`);

// === E4: fukurou + kawauso daily_post_target 9→5 ===
console.log('\n=== E4: fukurou/kawauso 減速 ===');
for (const slug of ['fukurou-sensei', 'kawauso-kaasan']) {
  const { error } = await sb.from('accounts').update({ daily_post_target: 5 }).eq('slug', slug);
  if (error) console.error(slug, error);
  else console.log(`[OK] ${slug} daily_post_target: 9 → 5`);
}

// === E5: ryunosuke系NGワードを 全10アカ prohibited_words に追加 ===
console.log('\n=== E5: ryunosuke系 NG ワード 全10アカに追加 ===');
const NG_WORDS_RYU = [
  '胡散臭いって思うよな',
  '胡散臭いって思うでしょ',
  '騙されたと思って',
  '俺も最初',
  '完全にナメてた',
  '完全になめてた',
  '足裏',
  'グラウンディング',
  '波動',
  'アファメーション',
  'マジで意味わかんなかった',
  'はいはいスピ乙',
];

const { data: personas } = await sb.from('account_personas').select('account_id, prohibited_words');
let prohibUpdated = 0;
for (const per of personas ?? []) {
  const existing = Array.isArray(per.prohibited_words) ? per.prohibited_words : [];
  const merged = Array.from(new Set([...existing, ...NG_WORDS_RYU]));
  if (merged.length === existing.length) continue;
  await sb.from('account_personas').update({ prohibited_words: merged }).eq('account_id', per.account_id);
  prohibUpdated++;
}
console.log(`[OK] prohibited_words updated for ${prohibUpdated} accounts`);

// === E3: profile_bio 中立化 (10アカ) ===
console.log('\n=== E3: profile_bio 中立化 ===');
const NEUTRAL_BIOS = {
  'kawauso-kaasan':
    '2児ワーママ。数年前、完璧主義で壊れた。産後うつも通った。今も崩れる夜はある、でも少しだけ楽になった。母親のきれいごと抜きの本音、ここに書いてる',
  'ryunosuke-kun':
    '元エンジニア。「エネルギーって結局なに？」を理系脳で分解してる。宗教感ゼロ、お布施不要、壺も売らない。怪しいスピに疲れた人のためのスピ入門',
  'fukurou-sensei':
    '元人事コンサルが数秘で"向いてる仕事"を解剖。転職すべきか残るべきか、適性データで考える投稿を毎日。面談で「自分の強みが初めてわかった」と言われるのが嬉しい',
  'kijitora-sensei':
    '毒親育ちです。「親が悪い」って言っていい場所がここ。実家がしんどい、義実家が地獄、盆と正月が憂鬱。全部ここで吐いてって',
  'shibainu-senpai':
    '転職2回、副業3回失敗した柴犬が占いとキャリアの両面から「辞めたい」に寄り添う。逃げの転職で正解だった話もする。きれいごとなしの仕事占い',
  'alpaca-sensei':
    '元銀行員。お金の不安って知識じゃなくて心の問題。「貯金いくらあれば安心？」の答えが人によって違う理由を毎日書いてる。不安の正体がわかると数字が怖くなくなる',
  'kojika-miku':
    '「やりたいことがわからない」を5年間タロットで聴いてきた元会社員。カードは答えじゃなくて"問い"をくれる。自分の本音に気づく投稿を毎日',
  'tsukiyo-yamaneko':
    '元ヨガインストラクター。月の満ち欠けと体調の波、5年記録してわかったことを書いてる。PMSで動けない日、やたら眠い日、イライラが止まらない日、全部月に理由がある',
  'hodokeru-kapibara':
    '元看護師。「なんかしんどい」の"なんか"を一緒にほどく投稿を毎日。病名がつかないしんどさを10年看てきた。がんばれとは言わない',
  'shiro-usagi-sama':
    'HSS型HSP当事者。刺激を求めるのに疲れる矛盾、全部わかるよ。職場で消耗する繊細さんへ「逃げ方」と「残り方」両方の処方箋を毎日',
};

for (const [slug, newBio] of Object.entries(NEUTRAL_BIOS)) {
  const { error } = await sb.from('accounts').update({ profile_bio: newBio }).eq('slug', slug);
  if (error) console.error(slug, error);
  else console.log(`[OK] ${slug.padEnd(22)} bio updated (${newBio.length}字)`);
}

console.log('\n=== すべて完了 ===');
console.log('注意: profile_bio の DB 更新だけでは Threads アプリ側に反映されない');
console.log('  → Threads アプリから手動で bio を書き換える必要');
console.log('  (10アカ × 30秒 = 5分程度の手作業)');
