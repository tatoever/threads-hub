import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: accounts } = await sb.from('accounts').select('id,slug').order('created_at');
const idToSlug = Object.fromEntries(accounts.map(a => [a.id, a.slug]));

const { data: posts } = await sb
  .from('posts')
  .select('id,account_id,slot_number,status,scheduled_at,content,reply_1,reply_2')
  .in('status', ['approved', 'draft', 'pending'])
  .order('scheduled_at', { ascending: true });

console.log(`\n=== 削除候補: ${posts.length}本 (approved/draft/pending) ===\n`);

const grouped = {};
for (const p of posts) {
  const slug = idToSlug[p.account_id] || p.account_id.slice(0, 8);
  if (!grouped[slug]) grouped[slug] = [];
  grouped[slug].push(p);
}

for (const [slug, list] of Object.entries(grouped)) {
  console.log(`## ${slug}  (${list.length}本)`);
  for (const p of list) {
    const jst = new Date(new Date(p.scheduled_at).getTime() + 9 * 3600 * 1000).toISOString();
    const preview = p.content.slice(0, 50).replace(/\n/g, ' ');
    const hasReply = p.reply_1 || p.reply_2 ? ' [reply有]' : '';
    console.log(`  slot${p.slot_number}  JST ${jst.slice(5, 16)}  ${p.status}  len=${p.content.length}${hasReply}  "${preview}..."`);
  }
  console.log('');
}

console.log(`合計: ${posts.length}本 削除予定`);
console.log(`(published は対象外、既にThreads公開済み)`);
