module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // Must remain last: Reanimated 4 compiles worklets through this plugin.
    plugins: ['react-native-worklets/plugin'],
  }
}
