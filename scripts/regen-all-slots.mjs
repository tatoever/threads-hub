import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SLUG = process.argv[2] || 'ryunosuke-kun';
const DATE = process.argv[3] || '2026-04-18';
const SLOTS = (process.argv[4] || '2,3,4,5,6,7,9').split(',').map(Number);

const { data: acct } = await sb.from('accounts').select('id').eq('slug', SLUG).single();
console.log(`target: ${SLUG}, slots: ${SLOTS.join(',')}`);

// Safety: cancel pending publish tasks
const { data: cancelled } = await sb.from('task_queue')
  .update({ status: 'cancelled' })
  .eq('task_type', 'publish')
  .in('status', ['pending', 'processing'])
  .select('id');
console.log(`safety: cancelled ${cancelled?.length || 0} pending publish tasks`);

// Delete existing approved posts for these slots (保険)
const { data: del } = await sb.from('posts')
  .delete()
  .eq('account_id', acct.id)
  .in('slot_number', SLOTS)
  .eq('status', 'approved')
  .gte('scheduled_at', `${DATE}T00:00:00`)
  .select('id,slot_number');
console.log(`deleted ${del?.length || 0} existing approved posts`);

// Enqueue generate tasks
for (const sn of SLOTS) {
  const { error } = await sb.from('task_queue').insert({
    account_id: acct.id,
    task_type: 'pipeline_generate',
    priority: 1,
    payload: { date: DATE, slot_number: sn },
    model: 'opus',
  });
  console.log(`slot${sn}:`, error?.message || 'enqueued');
}
