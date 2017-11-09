/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const webpack = require('webpack')
const WpDevServer = require('webpack-dev-server')
const WebpackConfigurator = require('../webpackConfig/WebpackConfigurator')
const themes = require('../Themes')

/**
 * The WebpackDevServer class.
 */
class WebpackDevServer {
  constructor () {
    this.configurator = new WebpackConfigurator()
    this.webpackConfig = null
    this.serverConfig = null
    this.compiler = null
    this.server = null

    this.init()
  }

  /**
   * Creates all the necessary elements.
   */
  init () {
    this.configurator
      .setConfigPath(themes.getConfig())
      .loadThemeConfig()

    this.webpackConfig = this.configurator.getConfig()
    this.serverConfig = this.configurator.getServerConfig()
    this.compiler = webpack(this.webpackConfig)
    this.server = new WpDevServer(this.compiler, this.serverConfig)
  }

  /**
   * Starts the webpack dev server instance.
   */
  start () {
    const { host, port } = this.serverConfig

    this.server.listen(port, host)
  }
}

module.exports = new WebpackDevServer()
