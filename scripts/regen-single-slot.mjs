import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SLUG = process.argv[2] || 'fukurou-sensei';
const SLOT = parseInt(process.argv[3] || '2', 10);
const DATE = process.argv[4] || '2026-04-18';

const { data: acct } = await sb.from('accounts').select('id,slug').eq('slug', SLUG).single();
console.log(`target: ${acct.slug} slot${SLOT} on ${DATE}`);

// Delete existing post for this slot on this date (JST)
const startUtc = new Date(`${DATE}T00:00:00+09:00`).toISOString();
const endUtc = new Date(`${DATE}T23:59:59+09:00`).toISOString();

const { data: existing } = await sb
  .from('posts')
  .select('id,status,content,scheduled_at')
  .eq('account_id', acct.id)
  .eq('slot_number', SLOT)
  .gte('scheduled_at', startUtc)
  .lte('scheduled_at', endUtc);

console.log(`found ${existing?.length || 0} existing post(s)`);
for (const p of (existing || [])) {
  if (p.status === 'published') {
    console.log(`SKIP published post ${p.id}`);
    continue;
  }
  await sb.from('posts').delete().eq('id', p.id);
  console.log(`deleted post ${p.id} (${p.status})`);
}

// Enqueue generate task
const { error } = await sb.from('task_queue').insert({
  account_id: acct.id,
  task_type: 'pipeline_generate',
  priority: 1,
  payload: { date: DATE, slot_number: SLOT },
  model: 'opus',
});
if (error) {
  console.log('enqueue error:', error.message);
} else {
  console.log(`enqueued pipeline_generate task for slot${SLOT}`);
}
