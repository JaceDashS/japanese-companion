const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const config = getDefaultConfig(__dirname);
config.resolver.extraNodeModules = {
  punycode: path.dirname(require.resolve("punycode/package.json")),
};
module.exports = config;
