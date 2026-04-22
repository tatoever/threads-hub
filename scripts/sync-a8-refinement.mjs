import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BASE = 'C:/Users/X99-F8/iCloudDrive/_AIエージェント/_db-snapshots/20260422';
// 修正した8記事（kawauso/ryunosukeは除外 = 変更なし）
const TARGETS = [
  { slug: 'kijitora-sensei',   file: 'kijitora-sensei_v6.md' },
  { slug: 'shibainu-senpai',   file: 'shibainu-senpai_v8.md' },
  { slug: 'alpaca-sensei',     file: 'alpaca-sensei_v5.md' },
  { slug: 'kojika-miku',       file: 'kojika-miku_v5.md' },
  { slug: 'tsukiyo-yamaneko',  file: 'tsukiyo-yamaneko_v8.md' },
  { slug: 'hodokeru-kapibara', file: 'hodokeru-kapibara_v5.md' },
  { slug: 'shiro-usagi-sama',  file: 'shiro-usagi-sama_v6.md' },
  { slug: 'fukurou-sensei',    file: 'fukurou-sensei_v8.md' }, // 二重https://のみ修正
];

function parseDraft(raw) {
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
    if (title && l !== '' && !l.startsWith('# ')) {
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
  for (const t of TARGETS) {
    const raw = fs.readFileSync(`${BASE}/${t.file}`, 'utf8');
    const parsed = parseDraft(raw);

    const { data: acc } = await sb.from('accounts').select('id').eq('slug', t.slug).single();
    const { data: arts } = await sb
      .from('articles')
      .select('id, title, version')
      .eq('account_id', acc.id)
      .order('updated_at', { ascending: false });
    const art = arts[0];
    const nextVersion = (art.version || 0) + 1;

    await sb.from('article_revisions').insert({
      article_id: art.id,
      version: nextVersion,
      title: art.title,
      body_md: parsed.body_md,
      word_count: parsed.word_count,
      reading_time_sec: parsed.reading_time_sec,
      note: 'A8 linkリファインメント: ココナラの電話占い→ココナラ の2回自然埋め込み、生a8→短縮リンク化、二重https://修正'
    });

    await sb.from('articles').update({
      body_md: parsed.body_md,
      word_count: parsed.word_count,
      reading_time_sec: parsed.reading_time_sec,
      version: nextVersion,
      updated_at: new Date().toISOString()
    }).eq('id', art.id);

    console.log(`[OK] ${t.slug}: v${nextVersion} (${parsed.word_count}字) → ${art.id}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
