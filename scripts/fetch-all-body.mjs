import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: accs } = await sb.from('accounts').select('id,slug');
  const outDir = 'C:/Users/X99-F8/iCloudDrive/_AIエージェント/_db-snapshots/20260422';
  fs.mkdirSync(outDir, { recursive: true });

  for (const a of accs) {
    const { data: arts } = await sb.from('articles').select('id,slug,title,body_md,word_count,version').eq('account_id', a.id).order('updated_at', { ascending: false });
    if (!arts || arts.length === 0) continue;
    const art = arts[0];
    const raw = `# ${art.title}\n\n${art.body_md}\n`;
    fs.writeFileSync(`${outDir}/${a.slug}_v${art.version}.md`, raw, 'utf8');
    console.log(`${a.slug}: ${art.word_count}字 v${art.version}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
