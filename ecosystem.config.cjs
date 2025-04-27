// ecosystem.config.js

module.exports = {
  apps: [
    {
      name: "backend", // PM2 process name
      script: "server.js", // Main file
      instances: 1, // Single instance (you can change to "max" later for cluster mode)
      autorestart: true, // Restart app if crash
      watch: ["."], // Watch project files for changes (only during development)
      ignore_watch: [
        "node_modules", // Don't watch node_modules (useless)
        "uploads", // Don't watch uploads folder
        "logs", // Don't watch logs folder
        "ecosystem.config.js", // Don't restart because of PM2 config change
      ],
      max_memory_restart: "500M", // Restart app if memory exceeds 500MB
      env: {
        NODE_ENV: "production", // Set environment mode
        PORT: 5000, // Default port (optional if already inside .env)
      },
      error_file: "./logs/err.log", // Path to error logs
      out_file: "./logs/out.log", // Path to normal console logs
      log_date_format: "YYYY-MM-DD HH:mm:ss", // Timestamp format in logs
    },
  ],
};
