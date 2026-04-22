/**
 * 昨日生成した7アカのドラフトを posts テーブルに status='approved' で登録。
 * publish.ts が scheduled_at を過ぎたら Threads API 経由で自動publish する。
 *
 * 事前処理:
 *   - tsukiyo の 🌙 絵文字は §5 ルール違反なので除去（句点に置換）
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// JST 時刻文字列 (YYYY-MM-DD HH:MM) を UTC ISO に変換
function jstToUtcIso(jstDate, jstTime) {
  const [Y, M, D] = jstDate.split('-').map(Number);
  const [h, m] = jstTime.split(':').map(Number);
  // JST は UTC+9 なので、UTC は -9 時間
  const utcDate = new Date(Date.UTC(Y, M - 1, D, h - 9, m, 0));
  return utcDate.toISOString();
}

const DRAFTS = [
  {
    slug: 'kijitora-sensei',
    scheduled_jst: { date: '2026-04-23', time: '22:15' },
    slot_time: '22:15',
    category: 'voice_validation',
    buzz_template_code: 'empathy_short',
    hook_type: '共感',
    theme: '実家からの着信に指が動かない夜',
    content: '実家からの着信、出る前に3秒固まる人いません？笑　別に喧嘩してるわけじゃないのに、指が動かないやつ。',
    reply_1: null,
    reply_2: null,
  },
  {
    slug: 'shibainu-senpai',
    scheduled_jst: { date: '2026-04-23', time: '07:45' },
    slot_time: '07:45',
    category: 'taishoku_aruaru',
    buzz_template_code: 'story_real',
    hook_type: '実況',
    theme: '通勤電車から2年前の自分を見る',
    content: '水曜の朝7時40分、満員電車の窓に額くっつけて外見てたら、向かいのホームで走ってくる人がいて。あれ、2年前のわたしだ、って思った。遅刻ギリギリで走って、席ついたら動悸で手震えて、それでも笑顔作ってた頃。今は走らなくなった。走らない方を選んだだけで、ちょっと呼吸が戻ってきたんだよね。',
    reply_1: null,
    reply_2: null,
  },
  {
    slug: 'alpaca-sensei',
    scheduled_jst: { date: '2026-04-23', time: '22:30' },
    slot_time: '22:30',
    category: 'money_feeling',
    buzz_template_code: 'diagnostic_tree',
    hook_type: '対比',
    theme: '通帳アプリ開く指が止まる人3タイプ',
    content: '夜に通帳アプリ開く指が止まる人。わかるよ、わたしもそうだった。銀行員だった頃も自分の通帳だけは震える手で開けてた。こういう人、だいたい3タイプに分かれるんだよね。Aは『引き落とし予定から先に見るタイプ』。残高より先に何が引かれるかを確認したい。数字よりスケジュールで安心する人。BとCも続けるね。',
    reply_1: 'Bは『残高を声に出して数え直すタイプ』。口の中で桁を確認する癖がある。昼は冷静に見れるのに夜だと毎回電卓を叩き直す。Cは『見た瞬間アプリ閉じるタイプ』。0.3秒で閉じて、見なかったことにして寝る。明日の自分に預ける人。どれに当てはまったか、最後にそれぞれの扱い方、置いておくね。',
    reply_2: 'Aの人は、引き落とし予定じゃなく残った額から先に見る日を週1だけ作るといいよ。Bの人は、数える前にお茶を一口。Cの人は、閉じる前に3秒だけ眺める。それだけで、お金観の源流が少しほどける感じがするんだ。あなたはどれタイプだった？',
  },
  {
    slug: 'kojika-miku',
    scheduled_jst: { date: '2026-04-23', time: '23:00' },
    slot_time: '23:00',
    category: 'daily_question',
    buzz_template_code: 'question_chain_tree',
    hook_type: '問い',
    theme: '「やりたいことがわからない」の下の問い',
    content: '夜23時、カード1枚引く前に。「やりたいことがわからない」って検索して、3時間経ってたこと、ありませんか？自己分析の本を3冊買って、ノートに書き出して、でも結局「わからない」に戻ってくる。でもね、その「わからない」の下に、もう一つ問いが眠っているかも、ですよ。',
    reply_1: 'それって、本当に「わからない」んでしょうか。「わかってるけど、選ぶのが怖い」を、わからないって言葉でくるんでいる、ってこともありますよ。やりたいことがないんじゃなくて、それを選んだときの自分を、まだ許せる気がしないだけ。もう一つだけ、奥に問いを置いていいですか？',
    reply_2: 'もしかして、あなたが本当に欲しいのは「正解」じゃなくて「誰かの許可」だったりしますか？タロットでも答えは出せません。でも、許可を待つ自分に気づけたら、動けますよ。答えは出さなくていい。その問い、持ち帰ってみてくださいね。',
  },
  {
    slug: 'tsukiyo-yamaneko',
    scheduled_jst: { date: '2026-04-23', time: '21:45' },
    slot_time: '21:45',
    category: 'moon_today',
    buzz_template_code: 'prophecy',
    hook_type: '予言',
    theme: '満月前3日の予言',
    // 🌙 絵文字を §5 ルールに従って除去（句点で置換）
    content: '今夜月を見上げてしまった人へ。3日以内に体が重くなる日が来ますよ。今夜は満月前3日、ホルモンの波がいちばん荒れるタイミング。責めないで、早めに寝てくださいね。月のせいにしていい日が来ます。',
    reply_1: null,
    reply_2: null,
  },
  {
    slug: 'hodokeru-kapibara',
    scheduled_jst: { date: '2026-04-23', time: '13:30' },
    slot_time: '13:30',
    category: 'nanka_decode',
    buzz_template_code: 'empathy_short',
    hook_type: '共感',
    theme: '「異常なし」と言われて帰る昼下がり',
    content: '「なんかしんどい」の"なんか"、病院行っても名前つかないやつですよね。異常なしって言われて帰る昼下がり、いちばんしんどくないですか？',
    reply_1: null,
    reply_2: null,
  },
  {
    slug: 'shiro-usagi-sama',
    scheduled_jst: { date: '2026-04-23', time: '07:30' },
    slot_time: '07:30',
    category: 'sensai_aruaru',
    buzz_template_code: 'chronicle_tree',
    hook_type: '実況',
    theme: '通勤電車HPが半分→HSP気づき→今',
    content: '朝7時半、通勤電車のドアが開いた瞬間、香水と汗と誰かのため息が一気に流れ込んできて、もうこの時点で今日のHPが半分減ってるのわかる、っていう繊細さん、いるよね。何年か前のわたしは、これが自分だけの異常だと思ってて、満員電車で泣きそうになる自分を責めてた。で、ある朝こんなことがあって。',
    reply_1: '隣の人のイヤホンから漏れる音が気になりすぎて、駅のベンチで動けなくなった朝があって。そのとき、スマホで『HSP DOES』って調べたら、深く処理する・刺激に過剰反応する、って書いてあって、あ、これ性格じゃなくて感覚システムの設定だったのか、って。自分を責める言葉が、少しだけほどけたのよね。そこから、今はこうなってる。',
    reply_2: '今も通勤電車で消耗する朝はあるよ。ひと駅早く降りて歩く日もあるし、耳栓を握りしめて耐える日もある。受け取りすぎるのは治らないけど、受け取った後の立て直しが少し早くなったかも。あなたにも、朝の改札でうずくまりたくなる日、ありませんか？',
  },
];

async function main() {
  const slugs = DRAFTS.map(d => d.slug);
  const { data: accs } = await sb.from('accounts').select('id, slug').in('slug', slugs);
  const idBySlug = new Map(accs.map(a => [a.slug, a.id]));

  for (const d of DRAFTS) {
    const accId = idBySlug.get(d.slug);
    if (!accId) { console.log(`[SKIP] ${d.slug} not found`); continue; }

    const scheduledIso = jstToUtcIso(d.scheduled_jst.date, d.scheduled_jst.time);

    // 同じ scheduled_at で重複登録を防ぐ
    const { data: existing } = await sb.from('posts')
      .select('id')
      .eq('account_id', accId)
      .eq('scheduled_at', scheduledIso)
      .maybeSingle();
    if (existing) {
      console.log(`[SKIP] ${d.slug}: already exists at ${scheduledIso}`);
      continue;
    }

    const row = {
      account_id: accId,
      content: d.content,
      reply_1: d.reply_1,
      reply_2: d.reply_2,
      status: 'approved',
      slot_number: 1,
      scheduled_at: scheduledIso,
      template_type: d.buzz_template_code,
      category: d.category,
      strategy_instructions: {
        cta: null,
        theme: d.theme,
        category: d.category,
        hook_type: d.hook_type,
        slot_number: 1,
        scheduled_time: d.slot_time,
        emotional_target: {},
        content_directive: d.theme,
        buzz_template_code: d.buzz_template_code,
        source: 'manual_v2_preview_2026-04-22',
      },
    };

    const { data: inserted, error } = await sb.from('posts').insert(row).select().single();
    if (error) {
      console.error(`[ERR] ${d.slug}`, error);
      continue;
    }
    console.log(`[OK] ${d.slug}: ${inserted.id} scheduled=${scheduledIso} (${d.scheduled_jst.date} ${d.scheduled_jst.time} JST)`);
  }

  // 確認
  console.log('\n=== 登録後の approved 状態 (7アカ分) ===');
  const { data: allApproved } = await sb
    .from('posts')
    .select('account_id, status, scheduled_at, content')
    .in('account_id', accs.map(a => a.id))
    .eq('status', 'approved')
    .gte('scheduled_at', '2026-04-23T00:00:00Z')
    .order('scheduled_at');
  const slugById = new Map(accs.map(a => [a.id, a.slug]));
  for (const p of allApproved ?? []) {
    const jstTs = new Date(new Date(p.scheduled_at).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
    console.log(`  ${slugById.get(p.account_id).padEnd(22)} ${jstTs} JST — ${p.content.slice(0, 40)}...`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
