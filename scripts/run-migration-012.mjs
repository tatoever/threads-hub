import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sql = readFileSync('supabase/migrations/012_tracker_exclusions.sql', 'utf8');

// 既存テーブル確認
const { error: e1 } = await sb.from('tracker_exclusions').select('id').limit(1);
if (!e1) {
  console.log('tracker_exclusions テーブルは既に存在します');
  process.exit(0);
}

// pg-meta ではなく、Supabase Management API の SQL endpoint を試す
// → anon key / service key では DDL 不可。Supabase Dashboard SQL Editor が必要。
console.log('---');
console.log('このマイグレーションは Supabase Dashboard の SQL Editor で実行してください:');
console.log('https://supabase.com/dashboard/project/bllypchfvmovgokgjfsj/sql/new');
console.log('---');
console.log(sql);
