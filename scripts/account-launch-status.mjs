import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// accounts
const { data: accs } = await sb
  .from('accounts')
  .select('id, slug, name, status, concept_status, threads_user_id, threads_username, threads_app_id, profile_bio, profile_picture_url, warmup_started_at, warmup_days_elapsed, warmup_daily_target, daily_post_target, reply_auto_enabled, created_at')
  .order('created_at');

// personas
const { data: personas } = await sb
  .from('account_personas')
  .select('account_id, display_name, bio:value_proposition, tone_style, family_canon, reply_rules, prohibited_words');
const personaByAcc = new Map((personas ?? []).map(p => [p.account_id, p]));

// threads tokens (別テーブルの可能性)
let tokenByAcc = new Map();
try {
  const { data: tokens } = await sb.from('threads_tokens').select('account_id, expires_at');
  if (tokens) {
    for (const t of tokens) {
      const expired = t.expires_at ? new Date(t.expires_at) < new Date() : null;
      tokenByAcc.set(t.account_id, { expires_at: t.expires_at, expired });
    }
  }
} catch {}

// articles
const { data: arts } = await sb.from('articles').select('account_id, id, status, slug');
const artByAcc = new Map();
for (const a of arts ?? []) {
  if (!artByAcc.has(a.account_id)) artByAcc.set(a.account_id, []);
  artByAcc.get(a.account_id).push(a);
}

// posts
const { data: posts } = await sb.from('posts').select('account_id, id, status, published_at').limit(5000);
const postsByAcc = new Map();
for (const p of posts ?? []) {
  if (!postsByAcc.has(p.account_id)) postsByAcc.set(p.account_id, []);
  postsByAcc.get(p.account_id).push(p);
}

// knowledge layers
let layerCountByAcc = new Map();
try {
  const { data: layers } = await sb.from('knowledge_layers').select('account_id, layer_type');
  if (layers) {
    for (const l of layers) {
      layerCountByAcc.set(l.account_id, (layerCountByAcc.get(l.account_id) ?? 0) + 1);
    }
  }
} catch {}

// daily_content_plan (直近1件あるか)
let planByAcc = new Map();
try {
  const { data: plans } = await sb.from('daily_content_plan').select('account_id, target_date').limit(500);
  if (plans) {
    for (const p of plans) {
      const prev = planByAcc.get(p.account_id);
      if (!prev || p.target_date > prev) planByAcc.set(p.account_id, p.target_date);
    }
  }
} catch {}

// buzz_templates count
let btplByAcc = new Map();
try {
  const { data: btpls } = await sb.from('buzz_templates').select('account_id');
  if (btpls) {
    for (const b of btpls) btplByAcc.set(b.account_id, (btplByAcc.get(b.account_id) ?? 0) + 1);
  }
} catch {}

console.log('\n=== LAUNCH READINESS MATRIX ===\n');
const cols = ['slug', 'status', 'concept', 'th_un', 'th_uid', 'token', 'bio', 'avatar', 'canon', 'reply_r', 'layers', 'art(pub)', 'posts(pub)', 'warmup', 'daily_plan', 'btpl'];
console.log(
  'slug'.padEnd(22),
  'status'.padEnd(10),
  'concept'.padEnd(9),
  'th_un'.padEnd(14),
  'th_uid'.padEnd(8),
  'token'.padEnd(6),
  'bio'.padEnd(4),
  'avatar'.padEnd(7),
  'canon'.padEnd(6),
  'rplyR'.padEnd(6),
  'lyrs'.padEnd(5),
  'art'.padEnd(7),
  'posts'.padEnd(7),
  'warmup'.padEnd(8),
  'plan',
  'btpl'
);

for (const a of accs) {
  const p = personaByAcc.get(a.id) ?? {};
  const articles = artByAcc.get(a.id) ?? [];
  const ps = postsByAcc.get(a.id) ?? [];
  const publishedArt = articles.filter(x => x.status === 'published').length;
  const publishedPosts = ps.filter(x => x.status === 'published' || x.published_at).length;
  const tokenInfo = tokenByAcc.get(a.id);
  const tokenStr = tokenInfo ? (tokenInfo.expired ? 'EXP' : 'OK') : (a.threads_user_id ? '?' : '-');
  const canonOk = p.family_canon && Object.keys(p.family_canon || {}).length > 0;
  const replyRulesCount = Array.isArray(p.reply_rules) ? p.reply_rules.length : (p.reply_rules && typeof p.reply_rules === 'object' ? Object.keys(p.reply_rules).length : 0);
  const warmupStr = a.warmup_started_at ? `D${a.warmup_days_elapsed ?? 0}/${a.warmup_daily_target ?? '?'}` : '-';

  console.log(
    a.slug.padEnd(22),
    (a.status ?? '').padEnd(10),
    (a.concept_status ?? '-').padEnd(9),
    (a.threads_username ?? '-').padEnd(14),
    (a.threads_user_id ? String(a.threads_user_id).slice(0, 6) + '..' : '-').padEnd(8),
    tokenStr.padEnd(6),
    (a.profile_bio ? 'OK' : '-').padEnd(4),
    (a.profile_picture_url ? 'OK' : '-').padEnd(7),
    (canonOk ? 'OK' : '-').padEnd(6),
    String(replyRulesCount).padEnd(6),
    String(layerCountByAcc.get(a.id) ?? 0).padEnd(5),
    `${publishedArt}/${articles.length}`.padEnd(7),
    `${publishedPosts}/${ps.length}`.padEnd(7),
    warmupStr.padEnd(8),
    planByAcc.get(a.id) ?? '-',
    btplByAcc.get(a.id) ?? 0
  );
}
