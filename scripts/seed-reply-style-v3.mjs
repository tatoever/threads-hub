/**
 * v3 (2026-04-23): キャラ別返信スタイル微調整フィールドを10アカに注入
 *   - laugh_usage: sometimes | rare
 *   - casual_register_preference: polite_casual (全10アカ)
 *   - reply_example_phrases: 各アカ5個
 *
 * 注意: 既存の reply_rules JSONB は保持し、新3フィールドを追加/上書きのみ
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STYLE = {
  'kawauso-kaasan': {
    laugh_usage: 'sometimes',
    casual_register_preference: 'polite_casual',
    reply_example_phrases: [
      '本当それですよね',
      'うちも同じです',
      'わかります〜',
      '言っちゃっていいですよ',
      '大丈夫じゃない日あります',
    ],
  },
  'ryunosuke-kun': {
    laugh_usage: 'sometimes',
    casual_register_preference: 'polite_casual',
    reply_example_phrases: [
      'マジでわかります',
      'それ合ってますよ',
      'いけますよ',
      '動けてる時点で勝ちです',
      '本当それですよね',
    ],
  },
  'fukurou-sensei': {
    laugh_usage: 'rare',
    casual_register_preference: 'polite_casual',
    reply_example_phrases: [
      'なるほどですね',
      'そうなんですよね',
      '面白いですね',
      'あるあるですよね',
      '構造で言うとそうなります',
    ],
  },
  'kijitora-sensei': {
    laugh_usage: 'sometimes',
    casual_register_preference: 'polite_casual',
    reply_example_phrases: [
      '本当それです',
      '当事者あるあるですよね',
      '我慢しなくていいですよ',
      'わかります、そっち側です',
      'それ普通にしんどいです',
    ],
  },
  'shibainu-senpai': {
    laugh_usage: 'sometimes',
    casual_register_preference: 'polite_casual',
    reply_example_phrases: [
      'わかります〜',
      '自分もそうでした',
      '1人じゃないですよ',
      '無理しすぎ注意ですね',
      '本当それですよね',
    ],
  },
  'alpaca-sensei': {
    laugh_usage: 'rare',
    casual_register_preference: 'polite_casual',
    reply_example_phrases: [
      'そうなんですよね',
      '大丈夫ですよ',
      'あるあるですよ',
      '気にしすぎじゃないです',
      '本当それですよね',
    ],
  },
  'kojika-miku': {
    laugh_usage: 'rare',
    casual_register_preference: 'polite_casual',
    reply_example_phrases: [
      'それ良い問いですね',
      'そう感じますよね',
      'カード的にもあります',
      '本当それですよね',
      'わかります',
    ],
  },
  'tsukiyo-yamaneko': {
    laugh_usage: 'sometimes',
    casual_register_preference: 'polite_casual',
    reply_example_phrases: [
      '月の日ですもんね',
      'そういう日ありますよね',
      '月任せでいいですよ',
      '本当それですよね',
      'わかります',
    ],
  },
  'hodokeru-kapibara': {
    laugh_usage: 'rare',
    casual_register_preference: 'polite_casual',
    reply_example_phrases: [
      'それ自然な反応ですよ',
      '責めなくていいですよ',
      '疲れて当然です',
      '本当それですよね',
      'わかります',
    ],
  },
  'shiro-usagi-sama': {
    laugh_usage: 'sometimes',
    casual_register_preference: 'polite_casual',
    reply_example_phrases: [
      'わかります',
      '繊細さん同士ですね',
      '受け取りすぎちゃう日ですよね',
      '本当それですよね',
      '無理しなくていい日です',
    ],
  },
};

async function main() {
  const slugs = Object.keys(STYLE);
  const { data: accs } = await sb.from('accounts').select('id, slug').in('slug', slugs);
  const idBySlug = new Map(accs.map(a => [a.slug, a.id]));

  for (const slug of slugs) {
    const accId = idBySlug.get(slug);
    if (!accId) { console.log(`[SKIP] ${slug}: account not found`); continue; }

    const { data: persona } = await sb
      .from('account_personas')
      .select('reply_rules')
      .eq('account_id', accId)
      .single();
    const rules = persona?.reply_rules || {};

    // 既存フィールドを保持しつつ、新3フィールドを追加/上書き
    rules.laugh_usage = STYLE[slug].laugh_usage;
    rules.casual_register_preference = STYLE[slug].casual_register_preference;
    rules.reply_example_phrases = STYLE[slug].reply_example_phrases;

    const { error } = await sb
      .from('account_personas')
      .update({ reply_rules: rules })
      .eq('account_id', accId);

    if (error) {
      console.error(`[ERR] ${slug}`, error);
      continue;
    }
    console.log(
      `[OK] ${slug.padEnd(22)} laugh=${STYLE[slug].laugh_usage.padEnd(10)} cas=${STYLE[slug].casual_register_preference} examples=${STYLE[slug].reply_example_phrases.length}個`
    );
  }

  console.log('\n=== 完了 ===');
  console.log('10アカすべての reply_rules に v3 フィールド3つを注入しました。');
  console.log('次の reply 生成から自動で反映されます。');
}

main().catch(e => { console.error(e); process.exit(1); });
