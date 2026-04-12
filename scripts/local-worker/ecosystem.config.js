module.exports = {
  apps: [
    {
      name: "threads-hub-worker",
      script: "npx",
      args: "tsx src/queue-worker.ts",
      cwd: __dirname,
      instances: 2, // 2 workers for parallel task processing
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
      // Logging
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      // Restart policy
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
