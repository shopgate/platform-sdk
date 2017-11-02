/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { fork } = require('child_process')
const { join } = require('path')
const AppSettings = require('../AppSettings')

/**
 * The FrontendProcess class.
 */
class FrontendProcess {
  constructor () {
    this.settings = AppSettings.getInstance()
    this.frontendSettings = this.settings.getFrontendSettings()
  }

  /**
   * Runs the Rapid Dev Server
   * @param {Object} options The process options.
   */
  runRapidDevServer (options) {
    try {
      fork(join(__dirname, './rapidDevServer'), {
        env: {
          appId: this.settings.getId(),
          ...this.frontendSettings.settings
        }
      })
    } catch (error) {
      console.error(error)
    }

    return this
  }
}

module.exports = FrontendProcess
