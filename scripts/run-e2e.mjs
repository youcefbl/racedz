import { spawn } from "node:child_process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const sourceUrl = process.env.RACEDZ_E2E_DATABASE_URL || process.env.DATABASE_URL;

if (!sourceUrl) {
  console.error("E2E setup requires DATABASE_URL or RACEDZ_E2E_DATABASE_URL.");
  process.exit(1);
}

const databaseUrl = new URL(sourceUrl);
const configuredName = databaseUrl.pathname.slice(1);

if (!process.env.RACEDZ_E2E_DATABASE_URL && !configuredName.endsWith("_ci") && !configuredName.endsWith("_e2e")) {
  databaseUrl.pathname = `/${configuredName}_e2e`;
}

const databaseName = databaseUrl.pathname.slice(1);
if (!databaseName.endsWith("_ci") && !databaseName.endsWith("_e2e")) {
  console.error(`Refusing to reset non-test database "${databaseName}". Use a database ending in _e2e or _ci.`);
  process.exit(1);
}

const childEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl.toString(),
  RACEDZ_SEED_BULK: "0",
  // Some E2E specs exercise server domain functions directly. Next aliases these marker modules
  // during bundling; the Node/Playwright process needs the same empty-module behavior.
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--require ./scripts/_stubs/stub-server-only.cjs"].filter(Boolean).join(" ")
};

console.info(`Resetting isolated E2E database "${databaseName}"...`);
await run("npx", ["prisma", "migrate", "reset", "--force", "--skip-generate"], childEnv);
await run("npx", ["playwright", "test", ...process.argv.slice(2)], childEnv);

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${signal || code}`));
    });
  });
}
