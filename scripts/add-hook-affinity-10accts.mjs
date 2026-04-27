/**
 * Q5 (専門家提案): 10アカの account_prompts.generate に
 * 「§8 hook_affinity」セクションを追加。
 *
 * 各キャラの「得意フック型 / 不向きフック型 / キーワード設計指針」を明示し、
 * 投稿生成時のフック選定とキーワード組み合わせの精度を上げる。
 *
 * 全アカ共通の原則:
 *   ✅ 強い組み合わせ: 曜日 × 身体部位 × 具体物 × 数字(3,5,10)
 *   ❌ 弱い組み合わせ: 抽象スピワード単体（「波動」「意識」単体）
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const HOOK_AFFINITY = {
  'kawauso-kaasan': {
    strong: ['実況（具体場面）', '共感（あるある）', '対比（理想/現実）'],
    weak: ['強い断言系', '抽象的な数字単体', 'tips/Howto型'],
    keyword_hint: '育児場面 × 時刻 × 具体物（送迎/夕飯/寝かしつけ/保育園バッグ等）',
    examples_good: '「金曜の朝、保育園バッグを持つ手がやけに重い」（曜日×具体物×身体感覚）',
    examples_bad: '「人生の本質は〜」のような抽象訓示',
  },
  'ryunosuke-kun': {
    strong: ['実況（身体感覚の描写）', '対比', '脱力描写（共感型予言）'],
    weak: ['tips/Howto指示', '抽象スピワード単体', '説教調'],
    keyword_hint: '曜日 × 身体感覚 × オノマトペ（脱力／ぐったり／抜ける）',
    examples_good: '「会議終わった瞬間、全身から力抜ける人いるよね」（共感+身体実況）',
    examples_bad: '「足裏に5秒だけ意識向けてみて」（tips型は ryunosuke のチャラ波動キャラに不一致）',
  },
  'fukurou-sensei': {
    strong: ['構造化解釈', '権威性フック（前職の事例）', '問いかけ'],
    weak: ['テンション高', '感情爆発系', '短文バズ単発'],
    keyword_hint: '数秘要素（ライフパス番号/個人年/誕生数）× 経歴 × 心理',
    examples_good: '「前職の給湯室で、自己紹介の話になったことがあって」（具体場面+経歴）',
    examples_bad: '「マジでヤバい」「神！」系の断言',
  },
  'kijitora-sensei': {
    strong: ['断言（毒入り）', '皮肉', '対比（家族の呪い vs 距離）'],
    weak: ['抽象的な数字単体', '長文説教'],
    keyword_hint: '義実家 × 行事（盆/正月/母の日）× 関係性ストレス',
    examples_good: '「義実家の正月、行かないって夫に伝えたのは何年か前の木曜の夜でした」（具体時刻+具体場面）',
    examples_bad: '「家族って大事ですよ」のような優等生発言',
  },
  'shibainu-senpai': {
    strong: ['実況（通勤/職場場面）', '対比（辞めた人/残った人）', '共感'],
    weak: ['抽象キャリア論', 'マネジメント論'],
    keyword_hint: '通勤シーン × 退職判断 × 数値（年収/年数/転職回数）',
    examples_good: '「水曜の朝、満員電車の窓に額くっつけて外見てたら」（曜日+場面+身体）',
    examples_bad: '「キャリアアップには3つの要素が」のような教科書的解説',
  },
  'alpaca-sensei': {
    strong: ['数字（金額/年齢）', '対比（リテラシー高/不安）', '問い'],
    weak: ['説教', '投資商品の推奨', '数字なしの抽象'],
    keyword_hint: '通帳/家計 × 体感（震え/胃痛/不安）× 心理（罪悪感/比較）',
    examples_good: '「夜に通帳アプリ開く指が止まる人」（具体動作+身体感覚）',
    examples_bad: '「お金は大切に使いましょう」',
  },
  'kojika-miku': {
    strong: ['問いかけ（多段階）', '宣言（カードの言葉）', '対比（決断/許可）'],
    weak: ['tips/Howto指示', '断言の押し付け', '未来予知系'],
    keyword_hint: 'カード × 内省 × 問い（決断ではなく許可）',
    examples_good: '「『答えを出す道具じゃないよ』、、、」（カードの語り）',
    examples_bad: '「3ヶ月以内に転職するべき」（断言の押し付け）',
  },
  'tsukiyo-yamaneko': {
    strong: ['曜日 × 身体部位 × 具体物 × 数字（月齢含む）', '実況', '断言（月齢ベース）'],
    weak: ['抽象スピワード単体', '医療アドバイス系'],
    keyword_hint: '月齢（満月前3日/新月）× PMS体感 × 時刻',
    examples_good: '「金曜の朝、保育園バッグを持つ手がやけに重い」（曜日+具体物+身体）',
    examples_bad: '「月のパワーで〜」のような抽象スピ',
  },
  'hodokeru-kapibara': {
    strong: ['実況（しんどさ場面）', '受容（責めない）', '権威性（看護師時代）'],
    weak: ['説教', '解決策の押し付け', '医療アドバイス系'],
    keyword_hint: '病院/医療 × 「異常なし」 × 駅のホーム × しんどさの体感',
    examples_good: '「看護師時代、『異常なし』と言われて帰る患者さんの8割が同じ顔だった」',
    examples_bad: '「もっと頑張りましょう」系の励まし',
  },
  'shiro-usagi-sama': {
    strong: ['実況（繊細さんあるある）', '対比（HSS型矛盾）', '宣言（受け取りすぎ）'],
    weak: ['強い断言（繊細さんへの押しは禁忌）', '指示型'],
    keyword_hint: '繊細さん × 環境（電車/会議/同僚）× 時刻',
    examples_good: '「会議の同僚のため息が3時間耳に残る」（具体場面+身体感覚+時間数値）',
    examples_bad: '「もっと強くなりましょう」系の自己啓発',
  },
};

const SECTION_BEGIN = "<!-- §8 hook_affinity BEGIN -->";
const SECTION_END = "<!-- §8 hook_affinity END -->";

function buildHookAffinitySection(slug) {
  const h = HOOK_AFFINITY[slug];
  return `## §8 hook_affinity（このキャラに合うフック設計）

### 強いフック型（このキャラの個性を引き立てる）
${h.strong.map(s => `- ${s}`).join('\n')}

### 不向きフック型（キャラ齟齬を起こす）
${h.weak.map(s => `- ${s}`).join('\n')}

### キーワード設計の指針
- **${h.keyword_hint}**

### 良い例（このキャラらしい）
${h.examples_good}

### 悪い例（キャラ崩壊）
${h.examples_bad}

### 全アカ共通の原則
- ✅ 強い組み合わせ: 曜日 × 身体部位 × 具体物 × 数字(3,5,10)
- ❌ 弱い組み合わせ: 抽象スピワード単体（「波動」「意識」「足裏」等の単体使用）
- 抽象語を使う時は必ず具体的な場面・身体感覚・数字を併走させる`;
}

function insertOrReplaceSection(original, body) {
  const wrapped = `${SECTION_BEGIN}\n${body}\n${SECTION_END}`;
  const beginIdx = original.indexOf(SECTION_BEGIN);
  if (beginIdx >= 0) {
    const endIdx = original.indexOf(SECTION_END);
    if (endIdx > beginIdx) {
      return original.slice(0, beginIdx) + wrapped + original.slice(endIdx + SECTION_END.length);
    }
  }
  return original.trim() + '\n\n' + wrapped + '\n';
}

async function main() {
  const slugs = Object.keys(HOOK_AFFINITY);
  const { data: accs } = await sb.from('accounts').select('id, slug').in('slug', slugs);
  const idBySlug = new Map(accs.map(a => [a.slug, a.id]));

  for (const slug of slugs) {
    const accId = idBySlug.get(slug);
    if (!accId) { console.log(`[SKIP] ${slug}`); continue; }

    const { data: prompt } = await sb.from('account_prompts')
      .select('id, system_prompt')
      .eq('account_id', accId)
      .eq('phase', 'generate')
      .maybeSingle();

    if (!prompt) { console.log(`[SKIP] ${slug}: no generate prompt`); continue; }

    const newSection = buildHookAffinitySection(slug);
    const updated = insertOrReplaceSection(prompt.system_prompt, newSection);

    const { error } = await sb.from('account_prompts')
      .update({ system_prompt: updated })
      .eq('id', prompt.id);

    if (error) { console.error(`[ERR] ${slug}`, error); continue; }
    console.log(`[OK] ${slug.padEnd(22)} ${prompt.system_prompt.length} → ${updated.length} 字`);
  }

  console.log('\n=== 完了 ===');
  console.log('10アカすべての account_prompts.generate に §8 hook_affinity を追加しました。');
}

main().catch(e => { console.error(e); process.exit(1); });
