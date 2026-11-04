import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = "japanese";
if (!["japanese", "certificate"].includes(app))
  throw new Error("Usage: npm run build:android -- japanese|certificate");
const android = path.resolve(root, "android");
if (!android.startsWith(root + path.sep) || android === root)
  throw new Error("Unsafe generated native path");
const marker = path.join(root, ".expo-native-owned");
if (fs.existsSync(android) && !fs.existsSync(marker))
  throw new Error(
    "Refusing to replace a native directory not created by this script",
  );
function run(args, options = {}) {
  const r = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, COMPANION_APP: app, CI: "1" },
    ...options,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
run(["scripts/prepare-domain.mjs"]);
fs.writeFileSync(marker, "Generated Expo native projects only.\n");
run([
  "node_modules/expo/bin/cli",
  "prebuild",
  "--platform",
  "android",
  "--clean",
  "--no-install",
]);
const env = {
  ...process.env,
  COMPANION_APP: app,
  CI: "1",
  NODE_ENV: "production",
};
const args = [
  "assembleRelease",
  "--no-daemon",
  "--console=plain",
  "-PreactNativeArchitectures=arm64-v8a,x86_64",
];
const result =
  process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/c", "gradlew.bat", ...args], {
        cwd: android,
        stdio: "inherit",
        env,
      })
    : spawnSync("./gradlew", args, { cwd: android, stdio: "inherit", env });
if (result.status !== 0) process.exit(result.status ?? 1);
const out = path.join(root, "dist", app);
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(
  path.join(android, "app/build/outputs/apk/release/app-release.apk"),
  path.join(out, app + "-companion-android.apk"),
);
console.log("Android APK: " + path.join(out, app + "-companion-android.apk"));
