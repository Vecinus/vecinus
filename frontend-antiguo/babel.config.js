module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind", unstable_transformImportMeta: true }]
    ],
    plugins: [
      "react-native-reanimated/plugin",
      "babel-plugin-transform-import-meta",
    ],
  };
};
