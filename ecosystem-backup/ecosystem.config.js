module.exports = {
  apps: [
    // 1. VITRINE (Next.js)
    {
      name: 'nextltd-vitrine',
      cwd: '/var/www/numericexport/vitrine',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/home/patrick/.pm2/logs/vitrine-error.log',
      out_file: '/home/patrick/.pm2/logs/vitrine-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // 2. API PRINCIPALE
    {
      name: 'nextltd-api',
      cwd: '/var/www/numericexport/api',
      script: 'src/index.js',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      ignore_watch: ["node_modules", "logs", "/var/www/storage/*"],
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/home/patrick/.pm2/logs/nextltd-api-error.log',
      out_file: '/home/patrick/.pm2/logs/nextltd-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    // 3. WORKERS (WhatsApp Launcher)
    {
      name: 'whatsapp-launcher',
      cwd: '/var/www/numericexport/api',
      script: 'src/workers/start-workers.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/patrick/.pm2/logs/whatsapp-launcher-error.log',
      out_file: '/home/patrick/.pm2/logs/whatsapp-launcher-out.log',
    },

    // 4. CRONS (Storage Cleaner)
    {
      name: 'storage-cleaner',
      cwd: '/var/www/numericexport/api',
      script: 'src/cron/storage-cleaner.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '0 0 * * *', // Se lance tous les jours à minuit
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/patrick/.pm2/logs/storage-cleaner-error.log',
      out_file: '/home/patrick/.pm2/logs/storage-cleaner-out.log',
    },

    // 5. DASHBOARD (Next.js) - AJOUTÉ ICI
    {
      name: 'nextltd-dashboard',
      cwd: '/var/www/numericexport/dashboard',
      script: 'npm',
      args: 'start -- -p 3003', // Force le port 3003 pour Nginx
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
      },
      error_file: '/home/patrick/.pm2/logs/dashboard-error.log',
      out_file: '/home/patrick/.pm2/logs/dashboard-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      min_uptime: '10s',
      max_restarts: 10,
    }
  ]
};
