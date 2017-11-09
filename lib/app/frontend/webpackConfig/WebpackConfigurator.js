/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The WebpackConfigurator class.
 */
class WebpackConfigurator {
  constructor () {
    /**
     * The default webpack dev server configuration.
     * @type {Object}
     */
    this.defaultServerConfig = {
      hot: true,
      host: process.env.optionsHost,
      port: process.env.optionsPort,
      progress: true,
      stats: {
        colors: true
      }
    }

    /**
     * The webpack configuration.
     * @type {Object}
     */
    this.config = {}

    /**
     * The theme configuration path.
     * @type {string}
     */
    this.configPath = null
  }

  /**
   * Sets the webpack config path.
   * @param {string} configPath The path to the webpack configuration.
   * @return {WebpackConfigurator}
   */
  setConfigPath (configPath) {
    this.configPath = configPath
    return this
  }

  /**
   * Loads the theme's webpack configuration.
   */
  loadThemeConfig () {
    try {
      this.config = require(this.configPath)
    } catch (error) {
      throw error
    }
  }

  /**
   * Returns the theme configuration.
   * @return {Object}
   */
  getConfig () {
    return this.config
  }

  /**
   * Returns the webpack devserver configuration.
   * @return {Object}
   */
  getServerConfig () {
    const themeDevConfig = this.config.devServer || {}

    // Combine all configs.
    return {
      ...this.defaultServerConfig,
      ...themeDevConfig
    }
  }
}

module.exports = WebpackConfigurator
