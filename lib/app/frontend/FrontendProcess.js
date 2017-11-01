/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { fork } = require('child_process')
const { join } = require('path')
const AppSettings = require('../AppSettings')
const FrontendSetup = require('./FrontendSetup')
const LogHelper = require('./LogHelper')

/**
 * The FrontendProcess class.
 */
class FrontendProcess {
  constructor () {
    this.settings = AppSettings.getInstance()
    this.frontendSettings = this.settings.getFrontendSettings()
    this.frontendSetup = new FrontendSetup()
    this.logHelper = LogHelper.getInstance()
    this.ip = this.frontendSettings.getIpAddress()
    this.port = this.frontendSettings.getPort()
    this.apiPort = this.frontendSettings.getApiPort()
  }

  /**
   * Checks if frontend configuration is set up and runs the setup if not.
   */
  init (options) {
    let promise = Promise.resolve()

    if (!this.ip || !this.port || !this.apiPort) {
      this.logHelper.logSetupNeeded()

      promise = this.frontendSetup.run(false)
    }

    return promise.then(() => {
      this.rapidDevServer(options.rapid)
    })
  }

  /**
   * Runs the Rapid Dev Server
   * @param {Object} options The process options.
   */
  rapidDevServer (options) {
    try {
      return fork(join(__dirname, './rapidDevServer'), {
        env: {
          appId: this.settings.getId(),
          ...this.frontendSettings.settings
        }
      })
    } catch (error) {
      throw error
    }
  }
}

module.exports = FrontendProcess
