import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DATE = '2026-04-18';

// publish 済みを除外した対象スロット（kawauso=slot1-2publish、fukurou=slot1-4publish）
// + 龍之介 slot7 はサニタイザ検証のため再生成
const jobs = [
  // kawauso: slot3-9、slot8はもう新版あるので除外
  { slug: 'kawauso-kaasan', slots: [3, 4, 5, 6, 7, 9] },
  // fukurou: slot5-9、slot7は新版あるので除外
  { slug: 'fukurou-sensei', slots: [5, 6, 8, 9] },
  // 龍之介: slot7 サニタイザ検証のみ再生成
  { slug: 'ryunosuke-kun', slots: [7] },
];

for (const job of jobs) {
  const { data: a } = await sb.from('accounts').select('id').eq('slug', job.slug).single();
  console.log(`\n## ${job.slug}`);

  // Delete existing approved/draft non-published posts for these slots
  const { data: del } = await sb.from('posts')
    .delete()
    .eq('account_id', a.id)
    .in('slot_number', job.slots)
    .in('status', ['approved', 'draft'])
    .gte('scheduled_at', `${DATE}T00:00:00-00:00`)
    .select('id,slot_number,status');
  console.log(`  deleted ${del?.length || 0} existing (non-published) posts`);

  for (const sn of job.slots) {
    const { error } = await sb.from('task_queue').insert({
      account_id: a.id,
      task_type: 'pipeline_generate',
      priority: 1,
      payload: { date: DATE, slot_number: sn },
      model: 'opus',
    });
    console.log(`  slot${sn}: ${error?.message || 'enqueued'}`);
  }
}

// Cancel pending publish tasks as safety
const { data: cancelled } = await sb.from('task_queue')
  .update({ status: 'cancelled' })
  .eq('task_type', 'publish')
  .in('status', ['pending', 'processing'])
  .select('id');
console.log(`\nsafety: cancelled ${cancelled?.length || 0} pending publish tasks`);
