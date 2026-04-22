import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGET_7 = [
  'kijitora-sensei',
  'shibainu-senpai',
  'alpaca-sensei',
  'kojika-miku',
  'tsukiyo-yamaneko',
  'hodokeru-kapibara',
  'shiro-usagi-sama',
];

const BASELINE_3 = ['kawauso-kaasan', 'ryunosuke-kun', 'fukurou-sensei'];

const ALL = [...BASELINE_3, ...TARGET_7];

// 1. accounts
const { data: accounts, error: accErr } = await sb
  .from('accounts')
  .select('*')
  .in('slug', ALL);
if (accErr) { console.error('accounts error', accErr); process.exit(1); }

// 2. account_personas
const { data: personas } = await sb
  .from('account_personas')
  .select('*')
  .in('account_id', accounts.map(a => a.id));

// 3. account_prompts
const { data: prompts } = await sb
  .from('account_prompts')
  .select('*')
  .in('account_id', accounts.map(a => a.id));

// 4. cta_destinations
const { data: ctas } = await sb
  .from('cta_destinations')
  .select('*')
  .in('account_id', accounts.map(a => a.id));

// 5. buzz_templates
const { data: buzz } = await sb
  .from('buzz_templates')
  .select('*')
  .in('account_id', accounts.map(a => a.id));

const byAccountId = (rows, accId) => rows?.filter(r => r.account_id === accId) || [];

console.log('\n===== SCHEMA KEYS =====');
console.log('accounts keys:', Object.keys(accounts[0] || {}).join(', '));
console.log('personas keys:', Object.keys(personas?.[0] || {}).join(', '));
console.log('prompts keys:', Object.keys(prompts?.[0] || {}).join(', '));
console.log('cta keys:', Object.keys(ctas?.[0] || {}).join(', '));
console.log('buzz keys:', Object.keys(buzz?.[0] || {}).join(', '));

console.log('\n===== PER ACCOUNT SUMMARY =====');
for (const slug of ALL) {
  const a = accounts.find(x => x.slug === slug);
  if (!a) { console.log(`\n[${slug}] ACCOUNT NOT FOUND`); continue; }
  const p = byAccountId(personas, a.id)[0];
  const promptsFor = byAccountId(prompts, a.id);
  const generatePrompt = promptsFor.find(x => x.phase === 'generate');
  const meetingPrompt = promptsFor.find(x => x.phase === 'meeting');
  const ctaList = byAccountId(ctas, a.id);
  const buzzList = byAccountId(buzz, a.id);

  console.log(`\n===== ${slug} =====`);
  console.log('-- accounts --');
  console.log({
    concept_status: a.concept_status,
    concept_definition_len: a.concept_definition ? (typeof a.concept_definition === 'string' ? a.concept_definition.length : JSON.stringify(a.concept_definition).length) : 0,
    profile_bio_len: a.profile_bio?.length || 0,
    profile_tagline: a.profile_tagline,
    warmup_started_at: a.warmup_started_at,
    warmup_daily_target: a.warmup_daily_target,
    daily_post_target: a.daily_post_target,
    schedule_offset_minutes: a.schedule_offset_minutes,
    reply_auto_enabled: a.reply_auto_enabled,
  });
  const replyKeys = Object.keys(a).filter(k => k.startsWith('reply_'));
  const replyObj = {};
  replyKeys.forEach(k => {
    const v = a[k];
    replyObj[k] = typeof v === 'string' && v.length > 60 ? `<str ${v.length}>` : v;
  });
  console.log('reply_* cols:', replyObj);

  console.log('-- persona --', p ? {
    has_row: true,
    tone_style_len: typeof p.tone_style === 'string' ? p.tone_style.length : (p.tone_style ? JSON.stringify(p.tone_style).length : 0),
    value_proposition_len: typeof p.value_proposition === 'string' ? p.value_proposition.length : (p.value_proposition ? JSON.stringify(p.value_proposition).length : 0),
    background_len: typeof p.background === 'string' ? p.background.length : (p.background ? JSON.stringify(p.background).length : 0),
    prohibited_words_count: Array.isArray(p.prohibited_words) ? p.prohibited_words.length : (p.prohibited_words ? 'obj' : 0),
    reply_rules_len: p.reply_rules ? JSON.stringify(p.reply_rules).length : 0,
    family_canon_len: p.family_canon ? JSON.stringify(p.family_canon).length : 0,
    family_canon_keys: p.family_canon && typeof p.family_canon === 'object' ? Object.keys(p.family_canon) : null,
    growth_principles_adapted_len: p.growth_principles_adapted ? JSON.stringify(p.growth_principles_adapted).length : 0,
    fan_marketing_stance_len: p.fan_marketing_stance ? JSON.stringify(p.fan_marketing_stance).length : 0,
    post_type_materials_len: p.post_type_materials ? JSON.stringify(p.post_type_materials).length : 0,
    prompt_files_len: p.prompt_files ? JSON.stringify(p.prompt_files).length : 0,
  } : '(NO ROW)');

  console.log('-- prompts --');
  console.log({
    generate: generatePrompt ? {
      system_prompt_len: generatePrompt.system_prompt?.length || 0,
      has_6_sections: generatePrompt.system_prompt?.includes('キャラクター定義') && generatePrompt.system_prompt?.includes('絶対にやる') && generatePrompt.system_prompt?.includes('絶対にやらない') && generatePrompt.system_prompt?.includes('AI臭'),
    } : '(NO ROW)',
    meeting: meetingPrompt ? {
      system_prompt_len: meetingPrompt.system_prompt?.length || 0,
    } : '(NO ROW)',
    phases_present: promptsFor.map(x => x.phase),
  });

  console.log('-- cta_destinations --', ctaList.length, 'rows');
  ctaList.forEach(c => console.log('  ', { id: c.id?.slice?.(0, 8), kind: c.kind, label: c.label, url_len: c.url?.length, is_active: c.is_active }));

  console.log('-- buzz_templates --', buzzList.length, 'rows');
  const buzzKinds = {};
  buzzList.forEach(b => { const k = b.kind || b.template_kind || 'unknown'; buzzKinds[k] = (buzzKinds[k] || 0) + 1; });
  console.log('  kinds:', buzzKinds);
}

// Sample a baseline prompt to show the 6-section structure
console.log('\n===== BASELINE SAMPLE: kawauso-kaasan generate prompt (first 500 chars) =====');
const kacc = accounts.find(a => a.slug === 'kawauso-kaasan');
if (kacc) {
  const kp = prompts.find(x => x.account_id === kacc.id && x.phase === 'generate');
  if (kp?.system_prompt) {
    console.log(kp.system_prompt.slice(0, 500));
    console.log('... (total', kp.system_prompt.length, 'chars)');
  }
}

// family_canon sample for baseline vs target
console.log('\n===== family_canon keys comparison =====');
for (const slug of ALL) {
  const a = accounts.find(x => x.slug === slug);
  if (!a) continue;
  const p = personas?.find(x => x.account_id === a.id);
  const fc = p?.family_canon;
  console.log(`${slug}:`, fc && typeof fc === 'object' ? `keys=[${Object.keys(fc).join(',')}]` : '(none)');
}
