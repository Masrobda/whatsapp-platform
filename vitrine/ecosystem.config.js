module.exports = {
  apps: [{
    name: 'nextltd-vitrine',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/numericexport/vitrine',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
   error_file: '/home/patrick/.pm2/logs/vitrine-error.log',
   out_file: '/home/patrick/.pm2/logs/vitrine-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    min_uptime: '10s',
    max_restarts: 10,
  }]
};
