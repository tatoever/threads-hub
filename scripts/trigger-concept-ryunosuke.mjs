import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SLUG = 'ryunosuke-kun';
const { data: acct } = await sb.from('accounts').select('id,slug,concept_status').eq('slug', SLUG).single();
console.log('target:', acct);

if (acct.concept_status !== 'pending_research') {
  console.log(`skipping: concept_status=${acct.concept_status}, expected pending_research`);
  process.exit(1);
}

await sb.from('accounts').update({ concept_status: 'researching' }).eq('id', acct.id);
console.log('set concept_status=researching');

const tasks = [
  { task_type: 'concept_research', priority: 1, model: 'opus' },
  { task_type: 'concept_analysis', priority: 2, model: 'opus' },
  { task_type: 'concept_proposal', priority: 3, model: 'opus' },
];
for (const t of tasks) {
  const { error } = await sb.from('task_queue').insert({
    account_id: acct.id,
    task_type: t.task_type,
    priority: t.priority,
    payload: { concept_design_run: true },
    model: t.model,
  });
  console.log(t.task_type, error ? `FAIL: ${error.message}` : 'enqueued');
}
console.log('\ndone. PM2 worker will pick up these tasks.');
