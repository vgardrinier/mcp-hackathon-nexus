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
        NODE_ENV: "development",
        API_KEY: "e51d31b5-51e4-4d04-b3d0-73c8fed5c961",
        DASHBOARD_URL: "http://localhost:3000",
        HTTP_SERVER_PORT: "3001"
      }
    }
  ]
};

