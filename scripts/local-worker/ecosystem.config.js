/**
 * PM2 Ecosystem Config — threads-hub (マルチアカウント基盤)
 *
 * 1プロセスのみ: queue-worker がタスクキューをポーリングして全タスクを逐次実行。
 * Claude CLI はセマフォで直列実行 (concurrency=1) のためインスタンスは1。
 * おきつねさま (threads-auto-agent) とは完全に別プロセス。
 *
 * 起動:
 *   cd C:/Dev/threads-hub/scripts/local-worker
 *   npx pm2 start ecosystem.config.js
 *   npx pm2 save
 *
 * 再起動:
 *   npx pm2 restart threads-hub-worker
 *
 * ログ確認:
 *   npx pm2 logs threads-hub-worker
 */
module.exports = {
  apps: [
    {
      name: "threads-hub-worker",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "src/queue-worker.ts",
      cwd: "C:/Dev/threads-hub/scripts/local-worker",

      node_args: "--max-old-space-size=512",
      env: {},

      autorestart: true,
      max_restarts: 20,
      min_uptime: "30s",
      restart_delay: 5000,
      max_memory_restart: "600M",

      error_file: "C:/Users/X99-F8/.pm2/logs/threads-hub-worker-error.log",
      out_file: "C:/Users/X99-F8/.pm2/logs/threads-hub-worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      watch: false,
    },
  ],
};
