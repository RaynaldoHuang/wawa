module.exports = {
  apps: [
    {
      name: 'wawa',
      cwd: process.env.APP_CWD || '/var/www/wawa',
      script: 'npm',
      args: 'start',
      interpreter: 'none',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: '1G',
      merge_logs: true,
      time: true,
      env: {
        APP_MODE: 'production',
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        NODE_OPTIONS: '--dns-result-order=ipv4first',
      },
      env_production: {
        APP_MODE: 'production',
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        NODE_OPTIONS: '--dns-result-order=ipv4first',
      },
    },
  ],
};
