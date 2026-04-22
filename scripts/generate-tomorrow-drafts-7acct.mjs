/**
 * 明日の朝を想定した投稿ドラフトを 7アカ分ローカルCLI Opusで生成
 * ドラフトDB登録はせず、結果をJSON/Markdownでファイルに保存する
 *
 * 動作:
 *   1. 7アカの account_prompts(generate) / meeting_prompt を DBから取得
 *   2. 各アカのtime_profileから明日の自然な時刻を1つ決定
 *   3. meeting_categories から note_teaser以外の1カテゴリ選定
 *   4. buzz_templates から1テンプレ選定
 *   5. user_prompt 組み立て → claude CLI --bare --model opus で生成
 *   6. 並列実行して結果をまとめる
 */
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SLUGS = ['kijitora-sensei', 'shibainu-senpai', 'alpaca-sensei', 'kojika-miku', 'tsukiyo-yamaneko', 'hodokeru-kapibara', 'shiro-usagi-sama'];

// 各アカの「明日の最適時刻」候補（primary_hoursから選定）
// + 選ぶカテゴリ（note_teaser以外）
// + 選ぶbuzz_template
const SPEC = {
  'kijitora-sensei':   { slot: { time: '22:15', label: '夜', weekday_intent: '水曜夜、実家から連絡来る時間帯' }, category_code: 'voice_validation', buzz_code: 'empathy_short' },
  'shibainu-senpai':   { slot: { time: '07:45', label: '朝', weekday_intent: '水曜朝、通勤電車' }, category_code: 'taishoku_aruaru', buzz_code: 'story_real' },
  'alpaca-sensei':     { slot: { time: '22:30', label: '夜', weekday_intent: '水曜夜、通帳アプリ開く時間' }, category_code: 'money_feeling', buzz_code: 'diagnostic_tree' },
  'kojika-miku':       { slot: { time: '23:00', label: '夜', weekday_intent: '水曜夜、カードを引く時間' }, category_code: 'daily_question', buzz_code: 'question_chain_tree' },
  'tsukiyo-yamaneko':  { slot: { time: '21:45', label: '夜', weekday_intent: '水曜夜、月を見上げる時間' }, category_code: 'moon_today', buzz_code: 'prophecy' },
  'hodokeru-kapibara': { slot: { time: '13:30', label: '昼', weekday_intent: '水曜昼、中だるみで疲れが出る時間' }, category_code: 'nanka_decode', buzz_code: 'empathy_short' },
  'shiro-usagi-sama':  { slot: { time: '07:30', label: '朝', weekday_intent: '水曜朝、通勤で消耗する時間' }, category_code: 'sensai_aruaru', buzz_code: 'chronicle_tree' },
};

// 明日の日付情報（JST水曜を想定: 2026-04-22が水曜なので2026-04-23が木曜だが...)
// とにかく「明日」をJSTで計算
function getTomorrowInfo() {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  const jstTomorrow = new Date(jstNow);
  jstTomorrow.setUTCDate(jstTomorrow.getUTCDate() + 1);
  const y = jstTomorrow.getUTCFullYear();
  const m = String(jstTomorrow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jstTomorrow.getUTCDate()).padStart(2, '0');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[jstTomorrow.getUTCDay()];
  return { date: `${y}-${m}-${d}`, weekday, isHoliday: jstTomorrow.getUTCDay() === 0 || jstTomorrow.getUTCDay() === 6 };
}

async function fetchAll() {
  const { data: accs } = await sb.from('accounts').select('id, slug, profile_tagline').in('slug', SLUGS);
  const accById = new Map(accs.map(a => [a.id, a]));
  const accBySlug = new Map(accs.map(a => [a.slug, a]));

  const { data: prompts } = await sb.from('account_prompts').select('account_id, phase, system_prompt').in('account_id', accs.map(a => a.id));
  const promptByAcc = new Map();
  for (const p of prompts ?? []) {
    if (!promptByAcc.has(p.account_id)) promptByAcc.set(p.account_id, {});
    promptByAcc.get(p.account_id)[p.phase] = p.system_prompt;
  }

  const { data: templates } = await sb.from('buzz_templates').select('code, name, description, prompt_body, length_hint');
  const tplByCode = new Map(templates.map(t => [t.code, t]));

  const { data: destinations } = await sb.from('cta_destinations').select('account_id, name, url, destination_type').eq('destination_type', 'internal_article');
  const destByAcc = new Map();
  for (const d of destinations ?? []) {
    if (!destByAcc.has(d.account_id)) destByAcc.set(d.account_id, []);
    destByAcc.get(d.account_id).push(d);
  }

  return { accBySlug, promptByAcc, tplByCode, destByAcc };
}

function buildUserPrompt(slug, spec, systemPromptLen, meetingSystemPrompt, tpl, tomorrow, destinations) {
  return `## タスク
あなたは「${slug}」のキャラクターとして、明日の投稿を生成します。
システムプロンプトに書かれたキャラクター定義・当事者ラベル・voice_fingerprint・17項目ルール・§7 time-of-day を厳守してください。

## 明日の投稿情報
- 投稿予定日時: ${tomorrow.date}（${tomorrow.weekday}曜${tomorrow.isHoliday ? '・休日' : '・平日'}） ${spec.slot.time} JST
- 時間帯ラベル: ${spec.slot.label}
- 当日の文脈: ${spec.slot.weekday_intent}

## 使用するコンテンツカテゴリ
- code: ${spec.category_code}
- このカテゴリ1つに集中して書く。他カテゴリに越境しない

## 使用するバズ構文テンプレ
- code: ${tpl.code} (${tpl.name})
- 目標文字数: ${tpl.length_hint}
- 構文指示:
${tpl.prompt_body}

## 出力仕様（厳守）
以下のJSONオブジェクト形式で出力してください。JSON以外の説明文は書かない。ツリー型テンプレなら main + reply_1 + reply_2 を、単発型なら main のみを埋める。

\`\`\`json
{
  "main": "（ここに投稿本文）",
  "reply_1": "（ツリー型の場合のみ。単発型は空文字列）",
  "reply_2": "（ツリー型の場合のみ。単発型は空文字列）"
}
\`\`\`

## 絶対ルール
- システムプロンプトの§5「絶対にやらないこと」を全て遵守
- §7 time-of-day のクロスオーバー禁止を守る（${spec.slot.label}の時間帯に他時間帯の語彙を混ぜない）
- 当事者ラベル越境禁止
- 経歴数字の捏造禁止（persona.background範囲内）
- JSON以外の文字は出力しない`;
}

function runClaude(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p', '--model', 'opus', '--system-prompt', systemPrompt, userPrompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => (stdout += d.toString()));
    proc.stderr.on('data', d => (stderr += d.toString()));
    proc.on('close', code => {
      if (code !== 0) reject(new Error(`claude exit ${code}: ${stderr.slice(0, 500)}`));
      else resolve(stdout);
    });
    proc.on('error', reject);
  });
}

function parseResult(raw) {
  // JSON部分を抽出
  const m = raw.match(/\{[\s\S]*?"main"[\s\S]*?\}/);
  if (!m) return { parseError: true, raw };
  try {
    return JSON.parse(m[0]);
  } catch (e) {
    return { parseError: true, raw, error: e.message };
  }
}

async function main() {
  const tomorrow = getTomorrowInfo();
  console.log(`明日の日付: ${tomorrow.date} (${tomorrow.weekday}曜${tomorrow.isHoliday ? '/休日' : '/平日'})`);

  const { accBySlug, promptByAcc, tplByCode, destByAcc } = await fetchAll();

  const jobs = SLUGS.map(async slug => {
    const acc = accBySlug.get(slug);
    if (!acc) return { slug, error: 'account not found' };
    const promptSet = promptByAcc.get(acc.id);
    if (!promptSet?.generate) return { slug, error: 'no generate prompt' };

    const spec = SPEC[slug];
    const tpl = tplByCode.get(spec.buzz_code);
    if (!tpl) return { slug, error: `no buzz_template: ${spec.buzz_code}` };

    const dests = destByAcc.get(acc.id) ?? [];

    const systemPrompt = promptSet.generate;
    const userPrompt = buildUserPrompt(slug, spec, systemPrompt.length, promptSet.meeting, tpl, tomorrow, dests);

    console.log(`[START] ${slug} (sys=${systemPrompt.length}字, tpl=${spec.buzz_code})`);
    const start = Date.now();
    try {
      const raw = await runClaude(systemPrompt, userPrompt);
      const parsed = parseResult(raw);
      const ms = Date.now() - start;
      console.log(`[DONE] ${slug} in ${(ms / 1000).toFixed(1)}s`);
      return {
        slug,
        display_name: acc.profile_tagline?.who ?? '',
        scheduled: `${tomorrow.date} ${spec.slot.time} JST (${tomorrow.weekday}曜${spec.slot.label})`,
        category: spec.category_code,
        buzz_template: `${spec.buzz_code} (${tpl.name})`,
        weekday_intent: spec.slot.weekday_intent,
        result: parsed,
        generation_ms: ms,
      };
    } catch (e) {
      console.log(`[ERR] ${slug}: ${e.message}`);
      return { slug, error: e.message };
    }
  });

  const results = await Promise.all(jobs);

  const outPath = 'C:/Users/X99-F8/iCloudDrive/_AIエージェント/_drafts-preview/tomorrow-7acct-' + Date.now() + '.json';
  fs.mkdirSync('C:/Users/X99-F8/iCloudDrive/_AIエージェント/_drafts-preview', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ tomorrow, results }, null, 2), 'utf8');

  console.log(`\n=== 保存先 ===`);
  console.log(outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
