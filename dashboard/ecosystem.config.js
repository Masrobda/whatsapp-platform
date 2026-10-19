module.exports = {
  apps: [{
    name: 'nextltd-dashboard',
    script: 'npm',
    // On force le port 3003 ici pour garantir la liaison avec Nginx
    args: 'start -- -p 3003',
    cwd: '/var/www/numericexport/dashboard',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3003,
    },
    error_file: '/var/log/numericexport/dashboard-error.log',
    out_file: '/var/log/numericexport/dashboard-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    min_uptime: '10s',
    max_restarts: 10,
  }]
};
