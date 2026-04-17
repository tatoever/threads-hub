import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: acct } = await sb.from('accounts').select('id,concept_status').eq('slug','ryunosuke-kun').single();

const { data: tasks } = await sb
  .from('task_queue')
  .select('task_type,status,created_at,started_at,completed_at,error_message,retry_count')
  .eq('account_id', acct.id)
  .in('task_type', ['concept_research','concept_analysis','concept_proposal'])
  .order('priority', { ascending: true });

console.log(`concept_status: ${acct.concept_status}`);
console.table(tasks.map(t => ({
  type: t.task_type,
  status: t.status,
  retry: t.retry_count,
  started: t.started_at?.slice(11,19) || '-',
  done: t.completed_at?.slice(11,19) || '-',
  err: t.error_message?.slice(0,60) || '',
})));

const { data: proposals } = await sb
  .from('concept_proposals')
  .select('proposal_number,title,oddity_score')
  .eq('account_id', acct.id)
  .order('proposal_number', { ascending: true });
console.log(`proposals: ${proposals?.length || 0}`);
if (proposals?.length) console.table(proposals);
