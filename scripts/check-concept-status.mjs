import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: accounts } = await sb
  .from('accounts')
  .select('id,slug,status,concept_status')
  .eq('status','active');
console.table(accounts);
