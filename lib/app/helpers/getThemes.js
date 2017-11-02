/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { existsSync, lstatSync, readdirSync } = require('fs')
const { join } = require('path')

// TODO: comments... Try to find a webpack.config inside the theme, use the default config if not found
const getWebpackConfig = (path) => {
  const themeConfig = join(path, 'webpack.config.js')

  if (existsSync(themeConfig)) {
    return themeConfig
  }

  return join(__dirname, '../frontend/webpackDevServer/defaultConfig/index.js')
}

// TODO: comments
const getThemes = () => {
  // Absolute path to the themes
  const source = `${process.env.PWD}/themes`

  // Get all folders inside the themes directory
  const folders = readdirSync(source).filter((folder) => lstatSync(join(source, folder)).isDirectory())

  // Build a nice array of themes and their respective configs
  return folders.map((name) => {
    // The absolute path to this theme
    const themePath = join(source, name)

    return {
      name,
      path: themePath,
      config: getWebpackConfig(themePath)
    }
  })
}

module.exports = getThemes
