const app = "japanese";
if (!["japanese", "certificate"].includes(app))
  throw new Error("Set COMPANION_APP to japanese or certificate");
const name =
  app === "japanese" ? "Japanese Companion" : "Certificate Companion";
export default {
  expo: {
    name,
    slug: app + "-companion",
    version: "0.1.0",
    orientation: "default",
    userInterfaceStyle: "dark",
    scheme: "jaces-" + app,
    web: { bundler: "metro", output: "single", name, backgroundColor: "#161a20" },
    android: {
      package: "com.jaces." + app + "companion",
      versionCode: 1,
      permissions: [],
      allowBackup: false,
    },
    ios: {
      bundleIdentifier: "com.jaces." + app + "companion",
      supportsTablet: true,
    },
    plugins: ["expo-secure-store", "./plugins/with-short-cmake-path.cjs"],
    extra: { companionApp: app, apiOrigin: "https://api.jace-s.com" },
  },
};
