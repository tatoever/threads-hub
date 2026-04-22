import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: accs, error: e1 } = await sb.from('accounts').select('id,slug,created_at');
  if (e1) { console.error('ERR1', e1); return; }
  console.error('accs.length =', accs?.length);
  accs?.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  const out = [];
  for (const a of accs || []) {
    const { data: arts, error: e2 } = await sb.from('articles').select('id,slug,title,word_count,version,updated_at,published_at').eq('account_id', a.id).order('updated_at', { ascending: false });
    if (e2) { console.error('ERR2', e2); continue; }
    if (!arts || arts.length === 0) continue;
    out.push({ acc_slug: a.slug, ...arts[0] });
  }
  console.log(JSON.stringify(out, null, 2));
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
