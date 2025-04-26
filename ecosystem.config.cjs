module.exports = {
  apps: [
    {
      name: "backend",               // PM2 process name
      script: "index.js",             // Entry point file
      interpreter: "node",            // Interpreter for ESM
      instances: 1,                   // Number of instances (1 for now)
      autorestart: true,              // Auto-restart if app crashes
      watch: ["."],                   // Watch the current directory for changes
      ignore_watch: [
        "node_modules",               // Ignore node_modules folder
        "uploads",                    // Ignore uploaded files folder
        "logs",                       // Ignore log files folder (if you have any)
        "ecosystem.config.cjs"         // Ignore the PM2 config itself (optional)
      ],
      max_memory_restart: "500M",      // Restart app if memory usage > 500MB
      env: {
        NODE_ENV: "production",        // Set NODE_ENV to production
        PORT: 5000,                    // Optional: in case you want PORT in env too
      },
      error_file: "./logs/err.log",    // Save errors here (you can create "logs" folder)
      out_file: "./logs/out.log",      // Save console.log outputs here
      log_date_format: "YYYY-MM-DD HH:mm:ss", // Neat timestamps for logs
    },
  ],
};

