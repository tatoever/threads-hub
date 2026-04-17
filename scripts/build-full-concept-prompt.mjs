import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: account } = await sb.from('accounts').select('name').eq('id','999d5537-e40c-4328-80c8-5aa55836b7a2').single();
const { data: persona } = await sb.from('account_personas').select('niche,target_audience,value_proposition,genre,background').eq('account_id','999d5537-e40c-4328-80c8-5aa55836b7a2').single();

const SYSTEM = `あなたはThreads市場リサーチャーです。指定されたターゲット層・ジャンルに対して、以下を網羅的に収集・整理してください。

## 収集対象
1. Threads 上位アカウント分析: 検索ワードで上位30投稿を仮想収集 → どんな「手段」で、どんな「立場」で発信している人が伸びているか
2. YouTube 人気チャンネル分析: 同ジャンルで登録者数が多いチャンネル10個程度 → 使われている切り口・フォーマット
3. Instagram 人気アカウント分析: 同じジャンルで人気のアカウント10個程度 → ポジショニングの傾向
4. 熱量の高いリアクション抽出: 各投稿のコメント・リプで「共感しました」「まさに今の自分」系の熱量リプがあったか

## 出力形式（JSON）
以下のスキーマで出力せよ。追加説明は一切不要。

{
  "queries_used": ["実際に検索したワード"],
  "common_means": ["市場で使われている『手段』のリスト"],
  "common_positions": ["市場で見られる『立場』のリスト"],
  "hot_reaction_patterns": ["熱量の高いリプのパターン"],
  "niche_blindspots": ["この市場で埋まっていない切り口（仮説）"],
  "cross_sns_successful_formats": [
    { "platform": "youtube", "format": "例: 30分検証企画", "why_it_works": "理由" }
  ]
}`;

const userPrompt = `## ターゲットキャラクター
- name: ${account.name}
- genre: ${persona.genre}
- niche: ${persona.niche}
- target_audience: ${persona.target_audience}
- value_proposition: ${persona.value_proposition}
- background: ${persona.background}

このキャラが参入する市場（Threads / YouTube / Instagram）を網羅的にリサーチし、指定されたJSONスキーマで出力せよ。`;

const full = `=== SYSTEM ===\n${SYSTEM}\n\n=== REQUEST ===\n${userPrompt}\n\n=== OUTPUT ===\n以下のJSON形式のみを出力してください。説明・マークダウン・コードブロック(\`\`\`)は一切不要。純粋なJSONのみ。`;

fs.writeFileSync('C:/Users/X99-F8/AppData/Local/Temp/full-concept-prompt.txt', full);
console.log('saved, len=', full.length);
