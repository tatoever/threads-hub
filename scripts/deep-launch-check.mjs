import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// threads_tokens 系の候補テーブルを探る
const tokenTables = ['threads_tokens', 'tokens', 'oauth_tokens', 'threads_oauth', 'account_tokens'];
for (const t of tokenTables) {
  const { data, error } = await sb.from(t).select('*').limit(1);
  if (!error) console.log(`[${t}] found, sample cols:`, data?.[0] ? Object.keys(data[0]) : '(empty)');
}

// knowledge_layers
const { data: klSample } = await sb.from('knowledge_layers').select('*').limit(1);
console.log('knowledge_layers cols:', klSample?.[0] ? Object.keys(klSample[0]) : '(empty)');
const { data: klByAcc } = await sb.from('knowledge_layers').select('account_id, layer_type');
console.log(`knowledge_layers rows: ${klByAcc?.length ?? 0}`);
if (klByAcc && klByAcc.length > 0) {
  const byAcc = new Map();
  for (const l of klByAcc) byAcc.set(l.account_id, (byAcc.get(l.account_id) ?? 0) + 1);
  console.log('knowledge_layers by account:');
  for (const [k, v] of byAcc) console.log(`  ${k.slice(0,8)}.. -> ${v}`);
}

// buzz_templates
const { data: btSample } = await sb.from('buzz_templates').select('*').limit(1);
console.log('\nbuzz_templates cols:', btSample?.[0] ? Object.keys(btSample[0]) : '(empty)');
const { data: btRows } = await sb.from('buzz_templates').select('id, account_id, template_type').limit(500);
console.log(`buzz_templates rows: ${btRows?.length ?? 0}`);

// daily_content_plan
const { data: planCols } = await sb.from('daily_content_plan').select('*').limit(1);
console.log('\ndaily_content_plan cols:', planCols?.[0] ? Object.keys(planCols[0]) : '(empty)');
