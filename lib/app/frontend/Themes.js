/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { existsSync, lstatSync, readdirSync } = require('fs')
const { join } = require('path')
const find = require('lodash/find')

class Themes {
  /**
   * @param {Object} themes The frontend themes
   */
  constructor () {
    this.currentTheme = null
    this.themes = this.findThemes()
  }

  getCurrentTheme () {
    const theme = find(this.themes, {name: this.currentTheme})
    return theme
  }

  getThemes () {
    return this.themes
  }

  setCurrentTheme (name) {
    this.currentTheme = name
    return this
  }

  /**
   * Find all themes inside the project.
   * @returns {array}
   */
  findThemes () {
    // Absolute path to the themes.
    const source = `${process.env.PWD}/themes`

    // Get all folders inside the themes directory.
    const folders = readdirSync(source).filter((folder) => lstatSync(join(source, folder)).isDirectory())

    // Build a nice array of themes and their respective configs.
    return folders.map((name) => {
      // The absolute path to this theme.
      const themePath = join(source, name)

      return {
        name,
        path: themePath,
        config: this.findWebpackConfig(themePath)
      }
    })
  }

  /**
   * Attempt to find a webpack.config.js inside the theme. When a config is not found then a default is used.
   * @param {string} path The path to look for a config.
   * @returns {string} A path to a Webpack config
   */
  findWebpackConfig (path) {
    const themeConfig = join(path, 'webpack.config.js')

    if (existsSync(themeConfig)) {
      return themeConfig
    }

    return join(__dirname, '../frontend/webpackDevServer/defaultConfig/index.js')
  }
}

module.exports = new Themes()
