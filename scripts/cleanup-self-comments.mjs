/**
 * 全10アカの comments テーブルから「自分のツリー返信」を削除
 * 自分のthreads_username と author_username が一致するレコードが対象
 *
 * 原因: comment-detect.ts が Threads API conversation の中から
 * 自分のreply_1/reply_2 を除外せずに insert していた
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: accounts } = await sb.from('accounts').select('id, slug, threads_username').order('slug');

let totalDeleted = 0;
const details = [];

for (const acc of accounts ?? []) {
  if (!acc.threads_username) {
    console.log(`[SKIP] ${acc.slug}: threads_username 未設定`);
    continue;
  }

  // 自分のusernameのコメントを列挙
  const { data: self } = await sb
    .from('comments')
    .select('id, created_at, content')
    .eq('account_id', acc.id)
    .eq('author_username', acc.threads_username);

  if (!self || self.length === 0) {
    console.log(`[OK]    ${acc.slug}: self-comments 0件`);
    details.push({ slug: acc.slug, deleted: 0 });
    continue;
  }

  const { error } = await sb
    .from('comments')
    .delete()
    .eq('account_id', acc.id)
    .eq('author_username', acc.threads_username);

  if (error) {
    console.error(`[ERR]   ${acc.slug}: ${error.message}`);
    details.push({ slug: acc.slug, error: error.message });
    continue;
  }

  console.log(`[CLEAN] ${acc.slug}: ${self.length}件 削除`);
  totalDeleted += self.length;
  details.push({ slug: acc.slug, deleted: self.length });
}

console.log(`\n=== 合計 ${totalDeleted}件 削除 ===`);

// 残ったコメント（本物）を各アカで確認
console.log('\n=== 削除後の残存コメント ===');
for (const acc of accounts ?? []) {
  const { count } = await sb
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', acc.id);
  console.log(`  ${acc.slug.padEnd(22)} ${count ?? 0}件`);
}
