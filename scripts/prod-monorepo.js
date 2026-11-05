import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (!args.includes("--skip-build")) {
  const result = spawnSync(process.execPath, ["scripts/expo.mjs", "export", "--platform", "web", "--output-dir", "dist/web"], {
    cwd: path.join(root, "mobile"), stdio: "inherit", windowsHide: true,
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
process.env.HOST ??= args.includes("--public") ? "0.0.0.0" : "127.0.0.1";
await import("./serve-static.mjs");
