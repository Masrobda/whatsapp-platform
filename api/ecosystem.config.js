module.exports = {
  apps: [
    {
      name: 'nextltd-api',
      script: 'src/index.js',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      ignore_watch: ["node_modules", "logs", "test_storage.txt", "/var/www/storage/*"],
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/home/patrick/.pm2/logs/nextltd-api-error.log',
      out_file: '/home/patrick/.pm2/logs/nextltd-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      min_uptime: '10s',
    },
    {
      name: 'whatsapp-launcher',
      script: 'src/workers/start-workers.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/patrick/.pm2/logs/whatsapp-launcher-error.log',
      out_file: '/home/patrick/.pm2/logs/whatsapp-launcher-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'storage-cleaner',
      script: 'src/cron/storage-cleaner.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: false, // Ne redémarre pas tout seul après avoir fini
      cron_restart: '0 0 * * *', // Se lance chaque nuit à minuit pile
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/patrick/.pm2/logs/storage-cleaner-error.log',
      out_file: '/home/patrick/.pm2/logs/storage-cleaner-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    }
  ]
};
