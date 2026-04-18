import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SLUG = process.argv[2] || 'ryunosuke-kun';
const ACTION = process.argv[3] || 'off'; // off | on

const { data: a } = await sb.from('accounts').select('id').eq('slug', SLUG).single();
const newActive = ACTION === 'on';
const { data, error } = await sb
  .from('cta_destinations')
  .update({ is_active: newActive })
  .eq('account_id', a.id)
  .eq('name', 'note記事誘導')
  .select('name,cta_type,url,is_active');
console.log(`${SLUG} cta: ${ACTION === 'off' ? 'DISABLED' : 'ENABLED'}`);
console.log(data);
if (error) console.log('error:', error.message);
