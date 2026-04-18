import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Step 1: Cancel any pending publish tasks to avoid racing with delete
const { data: cancelled } = await sb
  .from('task_queue')
  .update({ status: 'cancelled' })
  .eq('task_type', 'publish')
  .in('status', ['pending', 'processing'])
  .select('id');
console.log(`cancelled ${cancelled?.length || 0} publish tasks`);

// Step 2: Delete unpublished posts
const { data: deleted, error } = await sb
  .from('posts')
  .delete()
  .in('status', ['approved', 'draft', 'pending'])
  .gte('scheduled_at', '2026-04-17T21:00:00Z')
  .select('id,account_id,slot_number,scheduled_at');

if (error) {
  console.log('ERROR:', error.message);
  process.exit(1);
}

console.log(`\ndeleted ${deleted?.length || 0} unpublished posts:`);
const { data: accounts } = await sb.from('accounts').select('id,slug');
const idToSlug = Object.fromEntries(accounts.map(a => [a.id, a.slug]));
for (const p of (deleted || [])) {
  console.log(`  ${idToSlug[p.account_id]} slot${p.slot_number} (${p.scheduled_at})`);
}

// Step 3: Verify
const { data: remaining } = await sb
  .from('posts')
  .select('id')
  .in('status', ['approved', 'draft', 'pending'])
  .gte('scheduled_at', '2026-04-17T21:00:00Z');
console.log(`\nremaining unpublished: ${remaining?.length || 0}`);
