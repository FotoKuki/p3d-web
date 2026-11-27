module.exports = {
  apps: [
    {
      name: "p3d-customer",
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3000",
      env: {
        NODE_ENV: "production",
        P3D_SITE_ROLE: "customer",
      },
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "p3d-admin",
      script: "scripts/start-admin.cjs",
      env: {
        NODE_ENV: "production",
        P3D_SITE_ROLE: "admin",
      },
      autorestart: true,
      max_memory_restart: "512M",
    },
  ],
};
