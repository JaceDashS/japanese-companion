import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = "japanese";
const args = process.argv.slice(2);
if (!["japanese", "certificate"].includes(app))
  throw new Error("Unknown companion");
const prepared = spawnSync(process.execPath, ["scripts/prepare-domain.mjs"], {
  cwd: root,
  stdio: "inherit",
});
if (prepared.status !== 0) process.exit(prepared.status ?? 1);
const result = spawnSync(
  process.execPath,
  ["node_modules/expo/bin/cli", ...args],
  { cwd: root, stdio: "inherit", env: { ...process.env, COMPANION_APP: app } },
);
process.exit(result.status ?? 1);
