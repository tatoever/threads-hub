import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const targets = ['kawauso-kaasan', 'ryunosuke-kun', 'fukurou-sensei'];
const { data: accs } = await sb.from('accounts').select('id, slug, profile_tagline').in('slug', targets);

const out = {};
for (const a of accs) {
  const { data: prompts } = await sb.from('account_prompts').select('phase, system_prompt').eq('account_id', a.id);
  out[a.slug] = {
    profile_tagline: a.profile_tagline,
    prompts: {}
  };
  for (const p of prompts ?? []) out[a.slug].prompts[p.phase] = p.system_prompt;
}

const outDir = 'C:/Users/X99-F8/iCloudDrive/_AIエージェント/_db-snapshots/baseline-prompts';
fs.mkdirSync(outDir, { recursive: true });
for (const slug of targets) {
  fs.writeFileSync(`${outDir}/${slug}__tagline.json`, JSON.stringify(out[slug].profile_tagline, null, 2));
  for (const [phase, body] of Object.entries(out[slug].prompts)) {
    fs.writeFileSync(`${outDir}/${slug}__${phase}.md`, body || '');
  }
}
console.log('saved to', outDir);
console.log('files:', fs.readdirSync(outDir));
