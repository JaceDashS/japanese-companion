import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, ["scripts/expo.mjs", "start", "--web", ...process.argv.slice(2)], {
  cwd: path.join(root, "mobile"), stdio: "inherit", windowsHide: true,
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
