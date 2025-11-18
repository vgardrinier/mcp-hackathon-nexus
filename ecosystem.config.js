module.exports = {
  apps: [
    {
      name: "nexus-dashboard",
      script: "pnpm",
      args: "dev:dashboard",
      cwd: process.cwd(),
      interpreter: "none",
      watch: false,
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "development"
      }
    },
    {
      name: "nexus-mcp",
      script: "pnpm",
      args: "-w run dev:mcp:http",
      cwd: process.cwd(),
      interpreter: "none",
      watch: false,
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "development"
      }
    }
  ]
};

