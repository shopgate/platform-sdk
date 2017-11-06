/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

class WebpackConfigurator {
  constructor (themeConfigPath) {
    this.defaultServerConfig = {
      hot: true,
      host: process.env.optionsHost,
      port: process.env.optionsPort,
      progress: true,
      stats: {
        colors: true
      }
    }
    this.themeConfig = {}
    this.themeConfigPath = themeConfigPath
    this.loadThemeConfig()
  }

  loadThemeConfig () {
    try {
      this.themeConfig = require(this.themeConfigPath)
    } catch (error) {
      throw error
    }
  }

  getConfig () {
    return this.themeConfig
  }

  getServerConfig () {
    const themeDevConfig = this.themeConfig.devServer || {}

    // Combine all configs.
    return {
      ...this.defaultServerConfig,
      ...themeDevConfig
    }
  }
}

module.exports = WebpackConfigurator
