import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// slug => draft file path (v2 tone-fixed)
const BASE = 'C:/Users/X99-F8/iCloudDrive/_AIエージェント/note-projects';
const DRAFTS = [
  { slug: 'kijitora-sensei',   file: `${BASE}/kijitora-sensei/draft_20260422_v2.md` },
  { slug: 'shibainu-senpai',   file: `${BASE}/shibainu-senpai/draft_20260421_v2.md` },
  { slug: 'alpaca-sensei',     file: `${BASE}/alpaca-sensei/draft_20260422_v2.md` },
  { slug: 'kojika-miku',       file: `${BASE}/kojika-miku/draft_20260422_v2.md` },
  { slug: 'tsukiyo-yamaneko',  file: `${BASE}/tsukiyo-yamaneko/draft_20260422_v2.md` },
  { slug: 'hodokeru-kapibara', file: `${BASE}/hodokeru-kapibara/draft_20260422_v2.md` },
  { slug: 'shiro-usagi-sama',  file: `${BASE}/shiro-usagi-sama/draft_20260422_v2.md` },
];

function parseDraft(raw) {
  // line 1: # title
  // line 3: ## subtitle  (sometimes)
  // extract H1 title, drop first H2 (used as subtitle), keep rest as body
  const lines = raw.split(/\r?\n/);
  let title = null;
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!title && l.startsWith('# ')) {
      title = l.slice(2).trim();
      bodyStart = i + 1;
      continue;
    }
    if (title && l.startsWith('## ')) {
      // first H2 is treated as subtitle, drop it + following blank
      bodyStart = i + 1;
      while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart++;
      break;
    }
    if (title && l !== '' && !l.startsWith('##')) {
      // no subtitle H2, body starts from here
      bodyStart = i;
      break;
    }
  }
  const body_md = lines.slice(bodyStart).join('\n').trim();
  const plain = body_md.replace(/[#>*_`~\-]/g, '').replace(/\s+/g, '');
  const word_count = plain.length;
  const reading_time_sec = Math.max(60, Math.round((word_count / 600) * 60));
  return { title, body_md, word_count, reading_time_sec };
}

async function main() {
  for (const d of DRAFTS) {
    if (!fs.existsSync(d.file)) {
      console.log(`[SKIP] ${d.slug}: file not found`);
      continue;
    }
    const raw = fs.readFileSync(d.file, 'utf8');
    const parsed = parseDraft(raw);

    // get account_id
    const { data: acc } = await sb.from('accounts').select('id').eq('slug', d.slug).single();
    if (!acc) { console.log(`[SKIP] ${d.slug}: account not found`); continue; }

    // get article
    const { data: arts } = await sb
      .from('articles')
      .select('id, title, version')
      .eq('account_id', acc.id)
      .order('updated_at', { ascending: false });
    if (!arts || arts.length === 0) { console.log(`[SKIP] ${d.slug}: no articles`); continue; }
    const art = arts[0];

    const nextVersion = (art.version || 0) + 1;

    // insert revision snapshot
    await sb.from('article_revisions').insert({
      article_id: art.id,
      version: nextVersion,
      title: art.title,
      body_md: parsed.body_md,
      word_count: parsed.word_count,
      reading_time_sec: parsed.reading_time_sec,
      note: 'tone refinement v2: 「力になりたくて発信始めました」温度感統一'
    });

    // update article
    await sb
      .from('articles')
      .update({
        body_md: parsed.body_md,
        word_count: parsed.word_count,
        reading_time_sec: parsed.reading_time_sec,
        version: nextVersion,
        updated_at: new Date().toISOString()
      })
      .eq('id', art.id);

    console.log(`[OK] ${d.slug}: v${nextVersion} (${parsed.word_count}字) → ${art.id}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
