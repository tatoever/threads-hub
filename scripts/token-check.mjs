import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: tokens } = await sb.from('account_tokens').select('account_id, token_expires_at, status, last_refreshed_at');
const { data: accs } = await sb.from('accounts').select('id, slug, status, concept_status, profile_synced_at, warmup_started_at, warmup_daily_target');

const byAcc = new Map((tokens ?? []).map(t => [t.account_id, t]));

console.log('slug'.padEnd(22), 'status'.padEnd(9), 'concept'.padEnd(18), 'token_status'.padEnd(14), 'expires'.padEnd(12), 'profile_sync'.padEnd(12), 'warmup');
for (const a of accs) {
  const t = byAcc.get(a.id);
  const tstatus = t ? t.status : 'MISSING';
  const exp = t?.token_expires_at ? new Date(t.token_expires_at).toISOString().slice(0,10) : '-';
  const syncDate = a.profile_synced_at ? new Date(a.profile_synced_at).toISOString().slice(0,10) : '-';
  console.log(
    a.slug.padEnd(22),
    (a.status ?? '').padEnd(9),
    (a.concept_status ?? '').padEnd(18),
    tstatus.padEnd(14),
    exp.padEnd(12),
    syncDate.padEnd(12),
    a.warmup_started_at ? 'STARTED' : '-'
  );
}
