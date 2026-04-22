import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await sb.from('short_links').select('*');
  if (error) { console.error(error); return; }
  console.log(JSON.stringify(data, null, 2));
}
main();
