import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SLUG = process.argv[2] || 'ryunosuke-kun';
const DATE = process.argv[3] || '2026-04-18';

const { data: acct } = await sb.from('accounts').select('id,slug').eq('slug', SLUG).single();
console.log(`target: ${acct.slug} on ${DATE}`);

// Reset meeting pipeline_run
await sb.from('pipeline_runs')
  .update({ status: 'pending', output_data: null, completed_at: null })
  .eq('account_id', acct.id)
  .eq('date', DATE)
  .eq('phase', 'meeting');
console.log('reset meeting pipeline_run → pending');

// Enqueue meeting task
const { error } = await sb.from('task_queue').insert({
  account_id: acct.id,
  task_type: 'pipeline_meeting',
  priority: 1,
  payload: { date: DATE },
  model: 'opus',
});
console.log('enqueue meeting task:', error ? `FAIL: ${error.message}` : 'ok');
