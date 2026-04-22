/**
 * 9種類のアラート種別を alert_configs テーブルに登録
 *   - active 3種: shadowban_suspect / api_error / task_failed (デフォルトON)
 *   - planned 6種: token_expiring / meeting_failed / no_post_published /
 *                  comment_backlog / rate_limit_hit / zero_engagement (デフォルトOFF)
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CONFIGS = [
  // === 実装済み 3種 ===
  {
    alert_type: 'shadowban_suspect',
    enabled: true,
    default_severity: 'critical',
    display_label: 'シャドウBAN疑い',
    description: '投稿はしているのに閲覧数が0のまま。Threads側で表示抑制されている疑い',
    when_it_fires: '1日に3件以上 publish 済みで、合計 views が0の場合',
    why_it_matters: 'シャドウBANは通知なしで起こるため、アラートが唯一の検知手段。気づかず投稿を続けるとBANが深まる',
    recommended_action: '①別アカから検索してヒットするか確認 ②ハッシュタグ検索に出るか確認 ③2-3日投稿頻度を落として様子見 ④回復しなければ別アカ移行検討',
    implementation_status: 'active',
    sort_order: 1,
  },
  {
    alert_type: 'api_error',
    enabled: true,
    default_severity: 'warning',
    display_label: 'Threads API エラー',
    description: 'publish / reply 実行時に Threads API がエラーを返した',
    when_it_fires: 'rate limit, token無効, 画像拒否, 文字数超過 など',
    why_it_matters: '公開予定投稿が穴あきになる。トークン系なら今後全投稿が止まる予兆',
    recommended_action: '①エラー内容を確認 ②rate limitなら自然回復待ち ③token期限切れならOAuth再取得 ④failedになったpostsを再approve',
    implementation_status: 'active',
    sort_order: 2,
  },
  {
    alert_type: 'task_failed',
    enabled: true,
    default_severity: 'warning',
    display_label: 'バックグラウンド処理失敗',
    description: 'task_queue 上のタスクが実行中に例外で落ちた',
    when_it_fires: 'generate/meeting/research/analytics 等のタスクがTypeScript例外で停止',
    why_it_matters: 'generateが落ちると当該時刻の投稿が欠落。meetingが落ちると当日の計画がなくなる',
    recommended_action: '①message欄でどのtask_typeが落ちたか確認 ②task_queueで該当タスクを再キューイング ③3回連続なら実装バグ疑い',
    implementation_status: 'active',
    sort_order: 3,
  },

  // === 未実装(planned) 6種 ===
  {
    alert_type: 'token_expiring',
    enabled: false,
    default_severity: 'warning',
    display_label: 'トークン期限間近',
    description: 'Threads API のアクセストークンの期限切れが迫っている',
    when_it_fires: 'account_tokens.token_expires_at が7日以内になった場合',
    why_it_matters: 'トークン切れ後は publish/reply/comment_detect すべて停止する。事前検知が必須',
    recommended_action: '①Meta Developer Portal でトークンリフレッシュ ②account_tokens を新値で更新 ③自動refresh cron(月曜10時)の成否も確認',
    implementation_status: 'planned',
    sort_order: 4,
  },
  {
    alert_type: 'meeting_failed',
    enabled: false,
    default_severity: 'warning',
    display_label: '朝のmeeting失敗',
    description: '朝5時pipeline cronでmeeting phaseが失敗し、その日のdaily_content_planが生成されなかった',
    when_it_fires: 'pipeline_runs.phase=meeting かつ status=failed のレコードが発生した朝',
    why_it_matters: 'meetingなしではgenerate phaseが何も作れず、当日1日分の投稿がまるごと欠落する',
    recommended_action: '①朝一でアラート確認 ②task_queueでmeetingを再キューイング ③1時間以内に復旧すれば昼以降は間に合う',
    implementation_status: 'planned',
    sort_order: 5,
  },
  {
    alert_type: 'no_post_published',
    enabled: false,
    default_severity: 'warning',
    display_label: '1日0投稿(穴あき)',
    description: '当該アカウントでその日の publish が0件で終わった',
    when_it_fires: '日付をまたいでから、昨日分のpostsにstatus=publishedが1件もないアカがある場合',
    why_it_matters: 'Threadsのアルゴは毎日投稿するアカを優遇。穴あきが続くとリーチが落ちる',
    recommended_action: '①meeting/generate/publishのどこで止まったか特定 ②翌日の投稿を1.5倍にして埋め合わせ ③3日連続なら運用全体見直し',
    implementation_status: 'planned',
    sort_order: 6,
  },
  {
    alert_type: 'comment_backlog',
    enabled: false,
    default_severity: 'info',
    display_label: '未返信コメント大量',
    description: '24時間以上未返信のコメントが閾値(例:10件)を超えた',
    when_it_fires: 'reply_auto_enabled=false のアカで手動承認待ちが滞留した場合',
    why_it_matters: '返信しないとコメンターが離れる。ただし即事故ではないのでinfo級',
    recommended_action: '①管理画面でdraft状態の返信を一括承認 ②多すぎるならreply_auto_enabled=trueに昇格検討',
    implementation_status: 'planned',
    sort_order: 7,
  },
  {
    alert_type: 'rate_limit_hit',
    enabled: false,
    default_severity: 'warning',
    display_label: 'API rate limit (429)',
    description: 'Threads API から 429 Too Many Requests が返された',
    when_it_fires: 'api_errorの部分集合だが、429のみ専用で区別',
    why_it_matters: '10アカ×9投稿×返信自動化でAPIコール増加時に必ず出る。スケール時の課題',
    recommended_action: '①1-2時間は自然回復待ち ②連発するならschedule_offset_minutesを広げて分散 ③頻発するならMetaに上限引き上げ申請',
    implementation_status: 'planned',
    sort_order: 8,
  },
  {
    alert_type: 'zero_engagement',
    enabled: false,
    default_severity: 'info',
    display_label: '反応ゼロ (閲覧あり)',
    description: 'viewsはあるがlikes/replies/reposts が3日連続で0',
    when_it_fires: 'shadowban_suspectより軽症だがコンテンツが刺さってないサイン',
    why_it_matters: 'キャラ設計/テンプレ/時間帯ミスマッチの疑い。学習データとしては価値あり',
    recommended_action: '①ヒートマップで読まれてる箇所を確認 ②直近テンプレを別パターンに切り替え ③1週間続けばvoice_fingerprintを再チューニング',
    implementation_status: 'planned',
    sort_order: 9,
  },
];

async function main() {
  for (const c of CONFIGS) {
    const { data: existing } = await sb.from('alert_configs').select('alert_type').eq('alert_type', c.alert_type).maybeSingle();
    if (existing) {
      const { error } = await sb.from('alert_configs').update({ ...c, updated_at: new Date().toISOString() }).eq('alert_type', c.alert_type);
      if (error) console.error(`[ERR] ${c.alert_type}`, error);
      else console.log(`[UPDATED] ${c.alert_type} (${c.implementation_status}, enabled=${c.enabled})`);
    } else {
      const { error } = await sb.from('alert_configs').insert(c);
      if (error) console.error(`[ERR] ${c.alert_type}`, error);
      else console.log(`[INSERTED] ${c.alert_type} (${c.implementation_status}, enabled=${c.enabled})`);
    }
  }

  const { data: all } = await sb.from('alert_configs').select('alert_type, enabled, implementation_status, default_severity, display_label').order('sort_order');
  console.log(`\n=== 合計 ${all?.length} 種類 ===`);
  for (const c of all ?? []) {
    const mark = c.enabled ? 'ON ' : 'OFF';
    const stat = c.implementation_status === 'active' ? '✓' : '⏳';
    console.log(`  ${mark} ${stat} ${c.default_severity.padEnd(8)} ${c.alert_type.padEnd(22)} ${c.display_label}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
