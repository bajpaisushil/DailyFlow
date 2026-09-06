const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Notification tones are required() from source so Metro bundles them; without this the
// require resolves to nothing and every preview button is silently dead.
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, 'wav', 'mp3', 'm4a'])]

// Tree-shake harder in release bundles; keeps startup work down on low-end phones.
config.transformer.minifierConfig = {
  compress: { drop_console: true, passes: 2 },
}

module.exports = config
