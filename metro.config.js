const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Tree-shake harder in release bundles; keeps startup work down on low-end phones.
config.transformer.minifierConfig = {
  compress: { drop_console: true, passes: 2 },
}

module.exports = config
