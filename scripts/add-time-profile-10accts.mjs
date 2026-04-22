/**
 * 10アカすべての system_prompt / meeting_prompt に
 * 「§7 time-of-day / natural rhythm」セクションを追加
 *
 * 目的: 機械的投稿の不自然さを消す
 *   - 時間帯ミスマッチの語彙事故（朝7時に「寝落ち」等）を物理ブロック
 *   - キャラ固有の活動時間帯・生活リズムを明示
 *   - 平日/休日の自然なトーン差
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ===== 10アカのキャラ別活動時間プロファイル =====
const TIME_PROFILE = {
  'kawauso-kaasan': {
    primary_hours: '朝5-7時（起床・送迎準備）／ 夜21-23時（寝かしつけ後）／ 深夜0-1時（自分時間）',
    avoid_hours: '平日9-17時（仕事中で投稿できないキャラ設定）',
    rhythm_notes: '平日昼間の投稿はトイレ休憩の合間のような短文のみ。土日は家族時間に混ざる短文投稿が多い。日曜夜の「月曜しんどい」は鉄板',
    weekend_shift: '土曜は家族での外出/公園/食事/疲労、日曜は翌週への憂鬱・サザエさん的空気',
  },
  'ryunosuke-kun': {
    primary_hours: '朝6-8時（ラン後）／ 昼12-13時（休憩）／ 夜22-24時（トレ後）',
    avoid_hours: '深夜2-5時（筋トレ系キャラは早寝推奨）',
    rhythm_notes: '朝テンション高、昼は中間、夜は落ち着き気味。朝のプロテイン/ラン/瞑想などの語彙は朝限定',
    weekend_shift: '土日は長めのアクティビティ（登山/サーフィン/キャンプ）、平日は通勤合間の短文',
  },
  'fukurou-sensei': {
    primary_hours: '夜20-23時（静かな時間）／ 深夜0-2時（占いタイム）',
    avoid_hours: '朝5-10時（本業時間、ほぼ投稿なし設定）',
    rhythm_notes: '本業があるキャラなので平日日中は投稿しない。夜からエンジン入る。週末は日中も投稿OK',
    weekend_shift: '土日は日中から本気モード、数秘の深掘り記事に時間を使う語り',
  },
  'kijitora-sensei': {
    primary_hours: '夜20-23時（実家から連絡来る時間）／ 深夜0-2時（内省時間）',
    avoid_hours: '朝5-10時（毒親育ちは朝が弱い設定、軽い投稿のみ）',
    rhythm_notes: '盆/正月/母の日/父の日前は深夜投稿が増える。日曜夜の「月曜実家に電話するの憂鬱」鉄板',
    weekend_shift: '土曜は距離置いて落ち着いてる投稿、日曜夜〜月曜は実家圧の投稿が増える',
  },
  'shibainu-senpai': {
    primary_hours: '朝7-9時（通勤電車）／ 昼12-13時（昼休み）／ 夜19-22時（会社出た後）',
    avoid_hours: '深夜2-5時（中堅社員は早めに寝てる想定）',
    rhythm_notes: '会社員目線。通勤電車・昼休みの愚痴・帰り道の「辞めたい」の3点で回す。日曜夜の「月曜行きたくない」鉄板',
    weekend_shift: '土曜は回復モード、日曜夜は月曜憂鬱、月曜朝は通勤電車で爆発',
  },
  'alpaca-sensei': {
    primary_hours: '夜21-23時（通帳見る時間）／ 深夜0-2時（将来不安で眠れない）',
    avoid_hours: '朝6-10時（「朝から金の話したくない」の空気）',
    rhythm_notes: '給料日(25日前後)・月末・ボーナス月・年末(年収振り返り)に不安投稿が増える。昼は相談受ける時間',
    weekend_shift: '土曜は家計簿つける系、日曜夜は翌週の支出予定で頭が痛い系',
  },
  'kojika-miku': {
    primary_hours: '夜21-23時（カード引く時間）／ 深夜0-2時（自己分析）',
    avoid_hours: '朝6-10時（朝はタロット引かない設定）',
    rhythm_notes: '金曜夜の「一週間振り返り」、日曜夜の「明日どう動くか」、月末の「今月振り返り」が鉄板',
    weekend_shift: '土曜朝にじっくり一枚引き、日曜夜は週の振り返りから翌週の問いへ',
  },
  'tsukiyo-yamaneko': {
    primary_hours: '夜20-23時（月出てる時間）／ 深夜0-2時（月齢読む時間）',
    avoid_hours: '朝昼は活動時間帯外（昼は月の話しにくい）',
    rhythm_notes: '満月前3日・満月日・新月日・上弦/下弦の日は必ず投稿。生理周期・PMS期は鉄板',
    weekend_shift: '土日は月齢カレンダー系、満月日は夜中3時まで投稿することもある',
  },
  'hodokeru-kapibara': {
    primary_hours: '昼13-14時（疲れピーク）／ 夕17-19時（帰り道）／ 夜21-23時（休む前）',
    avoid_hours: '早朝5-7時（しんどい系は朝が遅い）',
    rhythm_notes: '火/水/木の中だるみに消耗投稿が集中。金曜は解放感、月曜朝は静かな共感',
    weekend_shift: '土曜は休養系、日曜夜は翌週のしんどさ予感系',
  },
  'shiro-usagi-sama': {
    primary_hours: '朝7-9時（通勤消耗）／ 夕17-19時（会議後疲弊）／ 夜21-23時（帰宅後復活）',
    avoid_hours: '深夜2-5時（繊細さんは早寝設定）',
    rhythm_notes: '月曜朝・水曜(会議多い日想定)・金曜夜に消耗投稿。日曜夜の「サザエさん症候群」が鉄板',
    weekend_shift: '土曜昼までは寝てる、午後から活動。日曜夕方から月曜への緊張が上がる',
  },
};

// ===== 時間帯共通語彙ガイド =====
const COMMON_TIME_GUIDE = `## §7 time-of-day / natural rhythm（自然な投稿時間と時間帯別語彙）

### 時間帯別の自然な情景・語彙ガイド
投稿のスケジュール時刻が注入されたら、その時間帯にふさわしい場面・語彙で書く。
時間帯ミスマッチ（朝7時に「今日も終わった」「寝落ち」等）は削除対象の事故扱い。

| 時間帯 | 自然な情景 | 使える語彙 |
|---|---|---|
| 朝 (5-10時)   | 起床／通勤電車／送迎／朝の洗面／朝ごはん／朝焼け | 「起きた」「おはよう」「今日これから」「朝から」「通勤」「送迎」 |
| 昼 (11-14時)  | 昼休み／ランチ／午後の会議／買い物／お昼寝 | 「お昼」「ランチ」「午後から」「午前中」「昼休み」「会議」 |
| 夕 (15-19時)  | 帰り道／お迎え／退勤／夕食準備／夕焼け | 「帰り道」「お迎え」「退勤」「夕方」「夕ご飯」「今日疲れた」 |
| 夜 (20-23時)  | 夕食後／寝かしつけ／お風呂／スマホ時間／夕飯片付け | 「お疲れさま」「今日も」「寝る前」「お風呂」「寝かしつけ」「夜更し」 |
| 深夜 (24-4時) | 眠れない／考え事／月／スマホ握ったまま／子ども寝た後 | 「眠れない」「深夜」「寝ないと」「夜中」「朝になってた」「寝落ち寸前」 |

### 時間帯クロスオーバー禁止（これを踏んだら即削除対象）
- 朝に「今日も終わった」「寝落ち」「深夜」「お疲れさま」禁止
- 昼に「おはよう」「寝かしつけ」「お風呂」禁止
- 夕に「おはよう」「ランチ中」「朝から」禁止
- 夜に「おはよう」「ランチ」「通勤」「午前中」禁止
- 深夜に「おはよう」「ランチ」「お迎え」「退勤」禁止

### 平日 / 休日の自然な差
- **平日** (月〜金): 仕事／通勤／送迎／会議／ランチタイム の語彙OK
- **土曜**: 家族時間／外出／リラックス／二度寝／外食
- **日曜**: 翌週への憂鬱／ゆっくり／家族／サザエさん的空気
- **平日語彙（出勤/会議/給湯室/昼休み/通勤）を土日に出さない**
- **休日語彙（外出/家族時間/二度寝）を平日朝に出さない**

### キャラ固有の活動時間帯
- 主な投稿時間帯: {{PRIMARY_HOURS}}
- 避ける時間帯: {{AVOID_HOURS}}
- リズムのクセ: {{RHYTHM_NOTES}}
- 平日/休日の差: {{WEEKEND_SHIFT}}

### 自然な投稿パターンの原則
- 毎日同じ時刻に同じ本数を出さない（機械的=AI臭の最大要因）
- 2本/日なら「朝×夜」「昼×深夜」「夕×夜」のような別時間帯の組み合わせを優先
- たまに「今日は1本だけ」「今日は深夜に突然1本」の日があってもいい（むしろ人間らしい）
- 投稿時刻は ±15分のゆらぎを持たせる（毎日21:00ちょうど、は不自然）
`;

function buildTimeSection(slug) {
  const p = TIME_PROFILE[slug];
  if (!p) return '';
  return COMMON_TIME_GUIDE
    .replace('{{PRIMARY_HOURS}}', p.primary_hours)
    .replace('{{AVOID_HOURS}}', p.avoid_hours)
    .replace('{{RHYTHM_NOTES}}', p.rhythm_notes)
    .replace('{{WEEKEND_SHIFT}}', p.weekend_shift);
}

// meeting prompt 用の短縮版
function buildMeetingTimeSection(slug) {
  const p = TIME_PROFILE[slug];
  if (!p) return '';
  return `
## §time-profile（このキャラの活動時間帯）
- 主な投稿時間帯: ${p.primary_hours}
- 避ける時間帯: ${p.avoid_hours}
- リズムのクセ: ${p.rhythm_notes}
- 平日/休日の差: ${p.weekend_shift}

スロットの scheduled_at を決める際、このキャラの primary_hours を優先する。
2本/日なら別時間帯の組み合わせ（朝×夜など）。同時間帯2連投は禁止。
毎日同じ時刻はNG（±15分のゆらぎ必須）。
平日語彙（出勤/会議/給湯室/ランチ）と休日語彙（外出/家族時間）は曜日で切り替える。
`;
}

// section7 マーカー（冪等性: 既に追加済みなら置換する）
const SECTION7_MARK_BEGIN = '<!-- §7 time-of-day BEGIN -->';
const SECTION7_MARK_END = '<!-- §7 time-of-day END -->';
const MEETING_MARK_BEGIN = '<!-- §time-profile BEGIN -->';
const MEETING_MARK_END = '<!-- §time-profile END -->';

function insertOrReplaceSection(original, markBegin, markEnd, newContent) {
  const wrapped = `${markBegin}\n${newContent}\n${markEnd}`;
  const beginIdx = original.indexOf(markBegin);
  if (beginIdx >= 0) {
    const endIdx = original.indexOf(markEnd);
    if (endIdx > beginIdx) {
      return original.slice(0, beginIdx) + wrapped + original.slice(endIdx + markEnd.length);
    }
  }
  return original.trim() + '\n\n' + wrapped + '\n';
}

async function main() {
  const slugs = Object.keys(TIME_PROFILE);
  const { data: accs } = await sb.from('accounts').select('id, slug').in('slug', slugs);
  const idBySlug = new Map(accs.map(a => [a.slug, a.id]));

  for (const slug of slugs) {
    const accId = idBySlug.get(slug);
    if (!accId) { console.log(`[SKIP] ${slug}`); continue; }

    const { data: prompts } = await sb.from('account_prompts').select('id, phase, system_prompt').eq('account_id', accId);
    if (!prompts || prompts.length === 0) { console.log(`[SKIP] ${slug}: no prompts`); continue; }

    for (const p of prompts) {
      let updated;
      if (p.phase === 'generate') {
        updated = insertOrReplaceSection(
          p.system_prompt,
          SECTION7_MARK_BEGIN,
          SECTION7_MARK_END,
          buildTimeSection(slug),
        );
      } else if (p.phase === 'meeting') {
        updated = insertOrReplaceSection(
          p.system_prompt,
          MEETING_MARK_BEGIN,
          MEETING_MARK_END,
          buildMeetingTimeSection(slug),
        );
      } else continue;

      const { error } = await sb.from('account_prompts').update({ system_prompt: updated }).eq('id', p.id);
      if (error) console.error(`${slug} ${p.phase} err`, error);
      else console.log(`[OK] ${slug} ${p.phase}: ${p.system_prompt.length} -> ${updated.length} 字`);
    }
  }

  console.log('\n=== 完了 ===');
  console.log('10アカすべての system_prompt に §7 time-of-day セクション、');
  console.log('10アカすべての meeting_prompt に §time-profile セクションを追加しました。');
}

main().catch(e => { console.error(e); process.exit(1); });
