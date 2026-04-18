import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: accounts } = await sb
  .from('accounts')
  .select('id,name,slug,threads_user_id,account_tokens(access_token,status),account_personas(display_name)')
  .order('created_at');

for (const a of accounts) {
  const token = Array.isArray(a.account_tokens) ? a.account_tokens.find(t => t.status === 'active') : a.account_tokens;
  const persona = Array.isArray(a.account_personas) ? a.account_personas[0] : a.account_personas;
  const displayName = persona?.display_name || a.name;

  if (!token?.access_token || !a.threads_user_id) {
    console.log(`${displayName}\thandle=?\t(no token)`);
    continue;
  }

  try {
    const res = await fetch(`https://graph.threads.net/v1.0/${a.threads_user_id}?fields=username&access_token=${token.access_token}`);
    const json = await res.json();
    const username = json.username || '?';
    console.log(`${displayName}\t@${username}\thttps://www.threads.net/@${username}`);
  } catch (e) {
    console.log(`${displayName}\tERROR: ${e.message}`);
  }
}
