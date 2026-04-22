/**
 * 10アカ全員の reply_rules JSONB に
 *   - exclusive_label_keywords: 自分の当事者領域
 *   - forbidden_other_label_keywords: 他9アカ占有領域
 * を追加して identity_lock を reply 生成に効かせる。
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 10アカ全員の当事者ラベル領域定義
const EXCLUSIVE = {
  'kawauso-kaasan':    ['ワーママ', '育児', '送迎', '保育園', '寝かしつけ', 'スマホ育児', '夕飯どうしよう', '母親失格'],
  'ryunosuke-kun':     ['エネルギー', '波動', '瞑想', '呼吸', 'スピで学んだ', 'グラウンディング', '体を整える'],
  'fukurou-sensei':    ['数秘', 'ライフパス', 'キャリア数秘', '人事コンサル', '9の年', '7の人', '5の年'],
  'kijitora-sensei':   ['毒親', '義実家', '母娘関係', '家族の呪い', '絶縁', '親子の境界線', '実家が憂鬱', '盆正月'],
  'shibainu-senpai':   ['転職2回失敗', '副業3回失敗', 'パワハラ', 'キャリア迷子', '辞めたい病', '退職判断', '逃げの転職'],
  'alpaca-sensei':     ['元銀行員10年', 'お金の不安', '貯金の罪悪感', 'お金観の源流', 'FP相談', '通帳アプリ'],
  'kojika-miku':       ['タロット5年', '自己分析ループ', '内省', 'カードの問い', '本音を聴く', '許可を求める'],
  'tsukiyo-yamaneko':  ['PMS', '月の満ち欠け', '月齢', '女性ホルモンの波', '月サイクル手帳', '満月前3日'],
  'hodokeru-kapibara': ['元看護師10年', '病名つかないしんどさ', '不定愁訴', '異常なしの夜', '駅のホームで泣く'],
  'shiro-usagi-sama':  ['HSS型HSP', '繊細さん', 'DOES', '刺激欲求と疲弊', '環境ミスマッチ', '受け取りすぎる'],
};

function forbiddenForSelf(selfSlug) {
  const others = [];
  for (const [slug, kws] of Object.entries(EXCLUSIVE)) {
    if (slug === selfSlug) continue;
    others.push({ slug, kws });
  }
  // 他アカごとにグルーピングして返す
  return others.flatMap(o => o.kws.map(k => `${k}（${o.slug}担当）`));
}

async function main() {
  const slugs = Object.keys(EXCLUSIVE);
  const { data: accs } = await sb.from('accounts').select('id, slug').in('slug', slugs);
  const idBySlug = new Map(accs.map(a => [a.slug, a.id]));

  for (const slug of slugs) {
    const accId = idBySlug.get(slug);
    if (!accId) { console.log(`[SKIP] ${slug}`); continue; }

    const { data: persona } = await sb.from('account_personas').select('reply_rules').eq('account_id', accId).single();
    const rules = persona?.reply_rules || {};

    rules.exclusive_label_keywords = EXCLUSIVE[slug];
    rules.forbidden_other_label_keywords = forbiddenForSelf(slug);

    const { error } = await sb.from('account_personas').update({ reply_rules: rules }).eq('account_id', accId);
    if (error) {
      console.error(`[ERR] ${slug}`, error);
      continue;
    }
    console.log(`[OK] ${slug}: exclusive=${rules.exclusive_label_keywords.length}件 / forbidden=${rules.forbidden_other_label_keywords.length}件`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
