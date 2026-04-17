import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: accounts } = await sb.from('accounts').select('id,slug').eq('status','active');
const ids = accounts.map(a => a.id);

const { data: posts } = await sb
  .from('posts')
  .select('id,account_id,slot_number,status,scheduled_at')
  .in('account_id', ids)
  .eq('status', 'approved')
  .order('scheduled_at', { ascending: true });

console.log(`Sliding ${posts.length} approved posts by +1 day...\n`);

let updated = 0;
for (const p of posts) {
  const oldDate = new Date(p.scheduled_at);
  const newDate = new Date(oldDate.getTime() + 24 * 60 * 60 * 1000);
  const newIso = newDate.toISOString();
  const slug = accounts.find(a => a.id === p.account_id).slug;

  const { error } = await sb
    .from('posts')
    .update({ scheduled_at: newIso })
    .eq('id', p.id);

  if (error) {
    console.error(`  FAIL ${slug} slot ${p.slot_number}: ${error.message}`);
  } else {
    console.log(`  ${slug.padEnd(16)} slot ${p.slot_number}  ${p.scheduled_at}  →  ${newIso}`);
    updated++;
  }
}

console.log(`\n✅ Updated ${updated}/${posts.length} posts`);
