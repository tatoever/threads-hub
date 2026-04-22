import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await sb.from('accounts').select('*').limit(1);
console.log('accounts columns:', data?.[0] ? Object.keys(data[0]) : '(no data)');

const { data: p } = await sb.from('account_personas').select('*').limit(1);
console.log('account_personas columns:', p?.[0] ? Object.keys(p[0]) : '(no data)');

const { data: posts } = await sb.from('posts').select('*').limit(1);
console.log('posts columns:', posts?.[0] ? Object.keys(posts[0]) : '(no data)');
