import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ACCT = '999d5537-e40c-4328-80c8-5aa55836b7a2';

// Delete all concept tasks (any status)
const { data: deleted, error: delErr } = await sb
  .from('task_queue')
  .delete()
  .eq('account_id', ACCT)
  .in('task_type', ['concept_research', 'concept_analysis', 'concept_proposal'])
  .select('id');
console.log(`deleted ${deleted?.length || 0} concept tasks`, delErr || '');

// Also clear concept_research / concept_analysis / concept_proposals rows for this account
for (const t of ['concept_research', 'concept_analysis', 'concept_proposals']) {
  const { data } = await sb.from(t).delete().eq('account_id', ACCT).select('id');
  console.log(`cleared ${t}: ${data?.length || 0} rows`);
}

// Reset account status
await sb.from('accounts').update({ concept_status: 'pending_research' }).eq('id', ACCT);
console.log('reset concept_status=pending_research');
