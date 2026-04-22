import { createClient } from '@supabase/supabase-js';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 各記事ごとのイベント集計
  const { data: accs } = await sb.from('accounts').select('id,slug');
  const accBySlug = new Map(accs.map(a => [a.slug, a.id]));

  const { data: arts } = await sb.from('articles').select('id,slug,account_id,title');

  const { data: events, error } = await sb
    .from('article_events')
    .select('article_id, event_type')
    .limit(50000);
  if (error) { console.error(error); return; }

  const byArticle = new Map();
  for (const e of events ?? []) {
    if (!byArticle.has(e.article_id)) byArticle.set(e.article_id, { view: 0, dwell: 0, scroll: 0, cta_click: 0 });
    byArticle.get(e.article_id)[e.event_type] = (byArticle.get(e.article_id)[e.event_type] ?? 0) + 1;
  }

  console.log('=== article_events 集計 ===');
  for (const a of arts) {
    const c = byArticle.get(a.id) ?? { view: 0, dwell: 0, scroll: 0, cta_click: 0 };
    const accSlug = [...accBySlug.entries()].find(([, id]) => id === a.account_id)?.[0];
    console.log(`${accSlug}/${a.slug}  view:${c.view} dwell:${c.dwell} scroll:${c.scroll} cta:${c.cta_click}`);
  }

  // short_links click_count
  const { data: sl } = await sb.from('short_links').select('slug, click_count, article_id');
  console.log('\n=== short_links click_count ===');
  for (const s of sl) console.log(`/go/${s.slug}  clicks:${s.click_count}`);
}
main();
