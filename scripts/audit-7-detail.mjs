import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALL = [
  'kawauso-kaasan', 'ryunosuke-kun', 'fukurou-sensei',
  'kijitora-sensei', 'shibainu-senpai', 'alpaca-sensei', 'kojika-miku',
  'tsukiyo-yamaneko', 'hodokeru-kapibara', 'shiro-usagi-sama',
];

const { data: accounts } = await sb.from('accounts').select('id, slug, profile_tagline, profile_bio').in('slug', ALL);
const { data: ctas } = await sb.from('cta_destinations').select('*').in('account_id', accounts.map(a => a.id));

console.log('\n===== CTA DETAIL =====');
for (const slug of ALL) {
  const a = accounts.find(x => x.slug === slug);
  if (!a) continue;
  const list = ctas.filter(c => c.account_id === a.id);
  console.log(`\n[${slug}] ${list.length} rows`);
  list.forEach(c => {
    console.log({
      name: c.name,
      cta_type: c.cta_type,
      url: c.url,
      description: c.description?.slice?.(0, 60),
      is_active: c.is_active,
      priority: c.priority,
      has_cta_templates: !!c.cta_templates,
      has_placement_rules: !!c.placement_rules,
    });
  });
}

// profile_tagline の有無を詳しく
console.log('\n===== profile_tagline / profile_bio =====');
for (const slug of ALL) {
  const a = accounts.find(x => x.slug === slug);
  if (!a) continue;
  console.log(`\n[${slug}]`);
  console.log('  tagline:', a.profile_tagline);
  console.log('  bio:', a.profile_bio);
}

// baseline fan_marketing_stance / post_type_materials / growth_principles を1件だけサンプル
console.log('\n===== BASELINE (kawauso-kaasan) personas jsonb keys =====');
const { data: p } = await sb.from('account_personas').select('*').eq('account_id', accounts.find(a => a.slug === 'kawauso-kaasan').id).single();
['growth_principles_adapted', 'fan_marketing_stance', 'post_type_materials', 'family_canon', 'prompt_files'].forEach(k => {
  const v = p[k];
  if (v && typeof v === 'object') {
    console.log(`  ${k} keys:`, Array.isArray(v) ? `array(${v.length})` : Object.keys(v).join(','));
  }
});

// 7アカの post_type_materials / growth_principles の keys
console.log('\n===== 7 accounts jsonb keys sanity =====');
for (const slug of ALL) {
  const a = accounts.find(x => x.slug === slug);
  if (!a) continue;
  const { data: pp } = await sb.from('account_personas').select('growth_principles_adapted, fan_marketing_stance, post_type_materials, prompt_files').eq('account_id', a.id).single();
  if (!pp) { console.log(`[${slug}] (no persona)`); continue; }
  const k = o => (o && typeof o === 'object') ? (Array.isArray(o) ? `arr(${o.length})` : Object.keys(o).join(',')) : '(none)';
  console.log(`[${slug}] gp:[${k(pp.growth_principles_adapted)}] fm:[${k(pp.fan_marketing_stance)}] pt:[${k(pp.post_type_materials)}] pf:[${k(pp.prompt_files)}]`);
}

// buzz_templates の全体件数（7アカに絞らず）
const { count: buzzCount } = await sb.from('buzz_templates').select('*', { count: 'exact', head: true });
console.log('\nbuzz_templates total rows:', buzzCount);
const { data: buzzSample } = await sb.from('buzz_templates').select('*').limit(3);
console.log('buzz_templates sample keys:', buzzSample?.[0] ? Object.keys(buzzSample[0]) : '(empty table)');
