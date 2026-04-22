/**
 * 明日の7アカ稼働前の最終監査
 *   1. account_tokens の有効性
 *   2. 明日 (2026-04-23) の時刻衝突（10アカ横断）
 *   3. cta_destinations 確認
 *   4. reply_rules 詳細
 *   5. profile_synced_at / avatar 有無
 *   6. account_prompts(reply) の有無
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// === 1. account_tokens ===
const { data: accs } = await sb.from('accounts').select('id, slug, status, threads_user_id, threads_username, profile_synced_at, profile_bio, profile_picture_url, reply_auto_enabled, reply_skip_rate, reply_max_per_post, reply_max_daily, reply_quiet_hours');
const { data: tokens } = await sb.from('account_tokens').select('account_id, token_expires_at, status');
const tokenByAcc = new Map(tokens.map(t => [t.account_id, t]));

console.log('\n=== 1. account_tokens / プロフィール同期状態 ===');
for (const a of accs.sort((x, y) => x.slug.localeCompare(y.slug))) {
  const t = tokenByAcc.get(a.id);
  const exp = t?.token_expires_at ? new Date(t.token_expires_at).toISOString().slice(0,10) : '-';
  const expired = t?.token_expires_at ? new Date(t.token_expires_at) < new Date() : true;
  const sync = a.profile_synced_at ? new Date(a.profile_synced_at).toISOString().slice(0,10) : '-';
  const bio = a.profile_bio ? `${a.profile_bio.length}字` : '空';
  const ava = a.profile_picture_url ? 'OK' : '空';
  console.log(`${a.slug.padEnd(22)} st=${(t?.status ?? '-').padEnd(8)} exp=${exp} ${expired?'⚠EXPIRED':''} sync=${sync} bio=${bio} avatar=${ava} uid=${(a.threads_user_id??'-').slice(0,8)}`);
}

// === 2. スケジュール衝突: 明日 2026-04-23 (UTC 2026-04-22 22:00 〜 2026-04-23 15:00 目安) ===
console.log('\n=== 2. 明日 2026-04-23 JST の投稿スケジュール (既存3アカ+新7アカ横断) ===');
const { data: posts } = await sb.from('posts')
  .select('account_id, scheduled_at, status, content, template_type')
  .in('status', ['approved', 'pending_review', 'draft'])
  .gte('scheduled_at', '2026-04-22T15:00:00Z')
  .lt('scheduled_at', '2026-04-23T15:00:00Z')
  .order('scheduled_at');
const slugById = new Map(accs.map(a => [a.id, a.slug]));
for (const p of posts ?? []) {
  const jst = new Date(new Date(p.scheduled_at).getTime() + 9*3600*1000).toISOString().slice(0,16).replace('T',' ');
  console.log(`  ${jst} JST  ${slugById.get(p.account_id).padEnd(22)} ${p.status.padEnd(10)} ${p.template_type?.padEnd(22)} ${p.content.slice(0, 30)}...`);
}

// === 3. cta_destinations ===
console.log('\n=== 3. cta_destinations ===');
const { data: ctas } = await sb.from('cta_destinations').select('account_id, name, destination_type, url');
const ctaBySlug = new Map();
for (const c of ctas ?? []) {
  const slug = slugById.get(c.account_id);
  if (!ctaBySlug.has(slug)) ctaBySlug.set(slug, []);
  ctaBySlug.get(slug).push(c);
}
for (const a of accs.sort((x, y) => x.slug.localeCompare(y.slug))) {
  const list = ctaBySlug.get(a.slug) ?? [];
  console.log(`  ${a.slug.padEnd(22)} ${list.length}件`);
  for (const c of list) console.log(`      - ${c.destination_type.padEnd(18)} ${c.name}`);
}

// === 4. reply_rules 詳細 (7アカ+3アカ) ===
console.log('\n=== 4. reply_rules 詳細 ===');
const { data: personas } = await sb.from('account_personas').select('account_id, reply_rules, signature_phrases:reply_rules');
const personaByAcc = new Map(personas.map(p => [p.account_id, p]));
for (const a of accs.sort((x, y) => x.slug.localeCompare(y.slug))) {
  const r = personaByAcc.get(a.id)?.reply_rules ?? {};
  const keys = Object.keys(r);
  const tone = r.tone_color ?? '-';
  const action = r.action_hint ?? '-';
  const focus = r.reply_focus ?? '-';
  const fp = r.first_person_when_used ?? r.first_person_usage ?? '-';
  const sigN = Array.isArray(r.signature_phrases) ? r.signature_phrases.length : 0;
  console.log(`  ${a.slug.padEnd(22)} tone=${tone.padEnd(8)} action=${action.padEnd(16)} focus=${focus.padEnd(28)} fp=${fp.padEnd(6)} sig=${sigN}件 keys=${keys.length}`);
}

// === 5. account_prompts(reply) 有無 ===
console.log('\n=== 5. account_prompts の phase 一覧 ===');
const { data: prompts } = await sb.from('account_prompts').select('account_id, phase, system_prompt');
const phasesByAcc = new Map();
for (const p of prompts ?? []) {
  const slug = slugById.get(p.account_id);
  if (!phasesByAcc.has(slug)) phasesByAcc.set(slug, []);
  phasesByAcc.get(slug).push({ phase: p.phase, len: p.system_prompt?.length ?? 0 });
}
for (const a of accs.sort((x, y) => x.slug.localeCompare(y.slug))) {
  const ps = phasesByAcc.get(a.slug) ?? [];
  const summary = ps.map(p => `${p.phase}:${p.len}字`).join(' / ');
  console.log(`  ${a.slug.padEnd(22)} ${summary || '(none)'}`);
}

// === 6. 全アカ reply 設定サマリ ===
console.log('\n=== 6. reply_auto_enabled / reply limits ===');
for (const a of accs.sort((x, y) => x.slug.localeCompare(y.slug))) {
  console.log(`  ${a.slug.padEnd(22)} auto=${String(a.reply_auto_enabled).padEnd(5)} skip=${a.reply_skip_rate}% maxPost=${a.reply_max_per_post} maxDay=${a.reply_max_daily} quiet=${a.reply_quiet_hours ?? '-'}`);
}
