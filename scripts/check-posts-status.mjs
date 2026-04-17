import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: accounts } = await sb.from('accounts').select('id,slug,status').eq('status','active');
console.log('=== active accounts ===');
console.table(accounts);
const ids = accounts.map(a=>a.id);
const { data: posts } = await sb.from('posts').select('account_id,slot_number,status,scheduled_at,published_at').in('account_id', ids).order('scheduled_at',{ascending:true});
const byStatus = {};
for (const p of posts) byStatus[p.status] = (byStatus[p.status]||0)+1;
console.log('status counts:', byStatus);
console.log('earliest scheduled:', posts[0]?.scheduled_at);
console.log('latest scheduled:', posts[posts.length-1]?.scheduled_at);
const bySlug = {};
for (const p of posts) {
  const slug = accounts.find(a=>a.id===p.account_id)?.slug;
  if (!bySlug[slug]) bySlug[slug] = [];
  bySlug[slug].push({ slot: p.slot_number, status: p.status, at: p.scheduled_at });
}
for (const [slug,list] of Object.entries(bySlug)) {
  console.log(`\n--- ${slug} (${list.length}) ---`);
  for (const p of list) console.log(`  slot ${p.slot}  ${p.status.padEnd(10)}  ${p.at}`);
}
