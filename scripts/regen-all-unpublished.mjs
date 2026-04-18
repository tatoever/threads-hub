import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DATE = '2026-04-18';
const accts = [
  { slug: 'ryunosuke-kun', id: '999d5537-e40c-4328-80c8-5aa55836b7a2' },
  { slug: 'kawauso-kaasan', id: '89ab6bc5-f8ef-4283-bda9-76d53e98bb80' },
  { slug: 'fukurou-sensei', id: '834fc47f-cda1-4c6b-8697-5109117a21ce' },
];

// Cancel pending publish tasks（保険）
const { data: cancelled } = await sb.from('task_queue')
  .update({ status: 'cancelled' })
  .eq('task_type', 'publish')
  .in('status', ['pending', 'processing'])
  .select('id');
console.log(`safety: cancelled ${cancelled?.length || 0} publish tasks`);

let totalEnqueued = 0;
for (const a of accts) {
  // Get published slot numbers to skip
  const { data: pub } = await sb.from('posts').select('slot_number').eq('account_id', a.id).eq('status','published').gte('scheduled_at', `${DATE}T00:00:00-00:00`);
  const publishedSlots = new Set((pub || []).map(p => p.slot_number));
  console.log(`\n${a.slug}: already published slots = [${[...publishedSlots].sort().join(',')}]`);

  // Get meeting plan slots
  const { data: pr } = await sb.from('pipeline_runs').select('output_data').eq('account_id', a.id).eq('date', DATE).eq('phase','meeting').single();
  const planSlots = pr?.output_data?.slots || [];

  // Delete existing non-published posts
  await sb.from('posts').delete().eq('account_id', a.id).in('status', ['draft','approved']).gte('scheduled_at', `${DATE}T00:00:00-00:00`);

  // Enqueue generate for non-published slots
  for (const slot of planSlots) {
    if (publishedSlots.has(slot.slot_number)) continue;
    const { error } = await sb.from('task_queue').insert({
      account_id: a.id,
      task_type: 'pipeline_generate',
      priority: 1,
      payload: { date: DATE, slot_number: slot.slot_number },
      model: 'opus',
    });
    if (!error) {
      totalEnqueued++;
      console.log(`  slot${slot.slot_number} (${slot.buzz_template_code}): enqueued`);
    }
  }
}
console.log(`\nTotal enqueued: ${totalEnqueued}`);
