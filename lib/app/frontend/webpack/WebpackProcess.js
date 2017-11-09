/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const webpack = require('webpack')
const rimraf = require('rimraf')
const WebpackConfigurator = require('../webpackConfig/WebpackConfigurator')
const themes = require('../Themes')
const logHelper = require('../LogHelper')
const logger = require('../../../logger')

class WebpackProcess {
  constructor () {
    this.configurator = new WebpackConfigurator()
    this.webpackConfig = null
    this.compiler = null

    this.init()
  }

  init () {
    this.configurator
      .setConfigPath(themes.getConfig())
      .loadThemeConfig()

    this.webpackConfig = this.configurator.getConfig()
    this.compiler = webpack(this.webpackConfig)
  }

  start () {
    // Log startup logo.
    logHelper.logLogoBuild()
    // Clear previous build.
    rimraf(this.webpackConfig.output.path, () => {
      // Run webpack.
      this.compiler.run(this.handleOutput)
    })
  }

  handleOutput (err, stats) {
    if (err) {
      logger.error(err.stack || err)

      if (err.details) {
        logger.error(err.details)
      }

      return
    }

    if (stats.hasErrors()) {
      logger.plain(stats.toString({
        colors: true,
        warnings: false,
        chunks: false
      }))

      return
    }

    logHelper.logBuildFinished()
  }
}

module.exports = new WebpackProcess()