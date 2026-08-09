const nodeBin = process.env.NODE_BIN ?? 'node';

module.exports = {
  apps: [
    {
      name: 'max-moderator-bot',
      script: 'dist/index.js',
      interpreter: nodeBin,
      exec_mode: 'fork',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
        // Node.js does not always use the system CA store; required for platform-api2.max.ru (Russian CA).
        NODE_EXTRA_CA_CERTS:
          process.env.NODE_EXTRA_CA_CERTS ?? '/etc/ssl/certs/ca-certificates.crt',
      },
    },
  ],
};
