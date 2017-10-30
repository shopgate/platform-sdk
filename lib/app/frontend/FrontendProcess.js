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
   * @param {Function} callback [description]
   * @return {[type]} [description]
   */
  runRapidDevServer (callback) {
    try {
      fork(join(__dirname, './rapidDevServer'), {
        env: {
          appId: this.settings.getId(),
          ...this.frontendSettings.settings
        }
      })

      callback(null)
    } catch (error) {
      callback(error)
    }
  }
}

module.exports = FrontendProcess
