const { withAppBuildGradle } = require("expo/config-plugins");
const path = require("node:path");
/** Keep generated C++ paths short while source remains in its workspace. */
module.exports = function withShortCmakePath(config) {
  return withAppBuildGradle(config, (config) => {
    const app = config.android.package.endsWith("japanesecompanion")
      ? "japanese"
      : "certificate";
    const staging = path
      .resolve(config.modRequest.projectRoot, "../.cxx", app)
      .replace(/\\/g, "/");
    const extra =
      '\nandroid {\n    externalNativeBuild { cmake { buildStagingDirectory file("' +
      staging +
      '") } }\n    defaultConfig { externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=250" } } }\n}\n';
    config.modResults.contents += extra;
    return config;
  });
};
