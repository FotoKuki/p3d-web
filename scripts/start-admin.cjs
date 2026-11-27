const { spawn } = require("node:child_process");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());
const port = process.env.P3D_ADMIN_PORT || "3001";
const origin = process.env.P3D_ADMIN_URL || "http://localhost:" + port;
const child = spawn(process.execPath, [
  require.resolve("next/dist/bin/next"), "start", "--hostname", process.env.P3D_ADMIN_HOST || "127.0.0.1", "--port", port,
], {
  stdio: "inherit",
  env: { ...process.env, AUTH_URL: origin, P3D_ADMIN_URL: origin, P3D_SITE_ROLE: "admin" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { process.exitCode = code ?? 1; });