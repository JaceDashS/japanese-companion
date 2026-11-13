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
    icon: "./assets/icon.png",
    experiments: { baseUrl: process.env.EXPO_PUBLIC_BASE_PATH || "" },
    web: { bundler: "metro", output: "single", name, backgroundColor: "#0e0d10", favicon: "./assets/icon.png" },
    android: {
      package: "com.jaces." + app + "companion",
      versionCode: 1,
      adaptiveIcon: { foregroundImage: "./assets/icon.png", backgroundColor: "#0e0d10" },
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
