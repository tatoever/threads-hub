/**
 * 凍結5アカ vs 生存5アカ の直近21日投稿を比較分析
 * 共通項を探して BAN原因の仮説を立てる
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BANNED = ['kijitora-sensei', 'shibainu-senpai', 'ryunosuke-kun', 'alpaca-sensei', 'hodokeru-kapibara'];
const SURVIVED = ['kawauso-kaasan', 'fukurou-sensei', 'kojika-miku', 'tsukiyo-yamaneko', 'shiro-usagi-sama'];

const { data: accs } = await sb.from('accounts').select('id, slug, threads_username');
const slugById = new Map(accs.map(a => [a.id, a.slug]));

const since = new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString();
const { data: posts, error: postsErr } = await sb
  .from('posts')
  .select('id, account_id, content, published_at, template_type, threads_post_id, slot_number, reply_1, reply_2')
  .gte('published_at', since)
  .eq('status', 'published')
  .order('published_at', { ascending: true })
  .limit(5000);

if (postsErr) {
  console.error('posts query error:', postsErr);
  process.exit(1);
}
console.log(`総 published posts (過去21日): ${posts?.length}件`);

const postIds = posts?.map(p => p.id) ?? [];
const { data: replies } = postIds.length > 0
  ? await sb.from('thread_replies').select('post_id, reply_index, content').in('post_id', postIds)
  : { data: [] };
const replyByPost = new Map();
for (const r of replies ?? []) {
  if (!replyByPost.has(r.post_id)) replyByPost.set(r.post_id, []);
  replyByPost.get(r.post_id).push(r);
}

const URL_RE = /https?:\/\/|note-sub|note\.com|t\.co|bit\.ly|\/go\//;
const FORMAL_END_TRAIL = /、{2,}$/;

const stat = {};
for (const slug of [...BANNED, ...SURVIVED]) {
  stat[slug] = {
    count: 0, treeCount: 0, urlCount: 0,
    byTemplate: new Map(),
    totalChars: 0,
    hourMap: new Map(),
    endingsComma: 0, endingsTripleComma: 0,
    examples: [],
  };
}

for (const p of posts ?? []) {
  const slug = slugById.get(p.account_id);
  if (!stat[slug]) continue;
  const s = stat[slug];
  s.count++;
  const reps = replyByPost.get(p.id) ?? [];
  const isTree = !!(p.reply_1 || p.reply_2 || reps.length > 0);
  if (isTree) s.treeCount++;
  const tt = p.template_type ?? 'unknown';
  s.byTemplate.set(tt, (s.byTemplate.get(tt) ?? 0) + 1);
  const c = p.content ?? '';
  s.totalChars += c.length;
  const jstHour = new Date(new Date(p.published_at).getTime() + 9 * 3600 * 1000).getUTCHours();
  s.hourMap.set(jstHour, (s.hourMap.get(jstHour) ?? 0) + 1);
  const trimmed = c.trim();
  if (FORMAL_END_TRAIL.test(trimmed)) s.endingsTripleComma++;
  else if (trimmed.endsWith('、')) s.endingsComma++;
  const replyTexts = [p.reply_1, p.reply_2, ...reps.map(r => r.content)].filter(Boolean);
  if (URL_RE.test(c) || replyTexts.some(t => URL_RE.test(t))) s.urlCount++;
  if (s.examples.length < 5) {
    const full = [c, ...replyTexts.map((t, i) => `\n[reply_${i + 1}] ${t}`)].join('');
    s.examples.push({
      jst: new Date(new Date(p.published_at).getTime() + 9 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' '),
      tree: isTree,
      template: p.template_type,
      text: full.slice(0, 500),
    });
  }
}

const lines = [];
const log = (s) => { console.log(s); lines.push(s); };

log(`=== 凍結5アカ vs 生存5アカ 21日間比較 (4/7-4/28) ===\n`);

for (const slug of [...BANNED, ...SURVIVED]) {
  const s = stat[slug];
  const isBan = BANNED.includes(slug);
  if (s.count === 0) {
    log(`[${isBan ? '❌BAN' : '✅生存'}] ${slug.padEnd(22)}  no posts in 21 days`);
    continue;
  }
  const avgChars = Math.round(s.totalChars / s.count);
  const treeRate = Math.round(s.treeCount / s.count * 100);
  const tplStr = [...s.byTemplate.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}=${v}`).join(' ');
  const peakHours = [...s.hourMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([h, n]) => `${h}時=${n}`).join(' ');
  log(`[${isBan ? '❌BAN' : '✅生存'}] ${slug.padEnd(22)}`);
  log(`   posts: ${s.count}件 | tree率: ${treeRate}% | 平均文字: ${avgChars}`);
  log(`   末尾「、」: ${s.endingsComma}件 / 「、、、」: ${s.endingsTripleComma}件 (合計 cliff-hanger ${s.endingsComma + s.endingsTripleComma}件)`);
  log(`   URL含み: ${s.urlCount}件`);
  log(`   templates: ${tplStr}`);
  log(`   peak hours (JST): ${peakHours}`);
  log('');
}

// === 集計差分 ===
log(`\n=== 凍結組 vs 生存組 集計差分 ===\n`);
const aggregate = (slugs) => {
  const a = { count: 0, treeCount: 0, urlCount: 0, totalChars: 0, endingsComma: 0, endingsTripleComma: 0, byTemplate: new Map() };
  for (const slug of slugs) {
    const s = stat[slug];
    a.count += s.count;
    a.treeCount += s.treeCount;
    a.urlCount += s.urlCount;
    a.totalChars += s.totalChars;
    a.endingsComma += s.endingsComma;
    a.endingsTripleComma += s.endingsTripleComma;
    for (const [k, v] of s.byTemplate) a.byTemplate.set(k, (a.byTemplate.get(k) ?? 0) + v);
  }
  return a;
};
const banAgg = aggregate(BANNED);
const surAgg = aggregate(SURVIVED);

log(`項目                    凍結組 (5)        生存組 (5)`);
log(`総投稿数                ${String(banAgg.count).padStart(15)} ${String(surAgg.count).padStart(15)}`);
log(`tree率                  ${(banAgg.treeCount / banAgg.count * 100).toFixed(0).padStart(14)}% ${(surAgg.treeCount / surAgg.count * 100).toFixed(0).padStart(14)}%`);
log(`URL含み率               ${(banAgg.urlCount / banAgg.count * 100).toFixed(0).padStart(14)}% ${(surAgg.urlCount / surAgg.count * 100).toFixed(0).padStart(14)}%`);
log(`平均文字数              ${String(Math.round(banAgg.totalChars / banAgg.count)).padStart(15)} ${String(Math.round(surAgg.totalChars / surAgg.count)).padStart(15)}`);
log(`末尾「、」率            ${(banAgg.endingsComma / banAgg.count * 100).toFixed(0).padStart(14)}% ${(surAgg.endingsComma / surAgg.count * 100).toFixed(0).padStart(14)}%`);
log(`末尾「、、、」率        ${(banAgg.endingsTripleComma / banAgg.count * 100).toFixed(0).padStart(14)}% ${(surAgg.endingsTripleComma / surAgg.count * 100).toFixed(0).padStart(14)}%`);
log('');

log(`凍結組 templates ranking:`);
for (const [k, v] of [...banAgg.byTemplate.entries()].sort((a, b) => b[1] - a[1])) log(`   ${k.padEnd(28)} ${v}`);
log(`\n生存組 templates ranking:`);
for (const [k, v] of [...surAgg.byTemplate.entries()].sort((a, b) => b[1] - a[1])) log(`   ${k.padEnd(28)} ${v}`);

// 結果をファイル保存
const outPath = 'C:/Users/X99-F8/iCloudDrive/_AIエージェント/_db-snapshots/banned-vs-survived-' + Date.now() + '.txt';
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('\n保存先:', outPath);

// 例文も別ファイルに
const exDoc = ['# 凍結5アカ vs 生存5アカ 投稿例文集 (各アカ最新3件)', ''];
for (const slug of [...BANNED, ...SURVIVED]) {
  const isBan = BANNED.includes(slug);
  exDoc.push(`## ${isBan ? '❌BAN' : '✅生存'} ${slug}\n`);
  for (const e of stat[slug].examples) {
    exDoc.push(`### ${e.jst} JST  tree=${e.tree}  tpl=${e.template}\n\`\`\`\n${e.text}\n\`\`\`\n`);
  }
}
const exPath = 'C:/Users/X99-F8/iCloudDrive/_AIエージェント/_db-snapshots/banned-vs-survived-examples-' + Date.now() + '.md';
fs.writeFileSync(exPath, exDoc.join('\n'), 'utf8');
console.log('例文保存先:', exPath);
