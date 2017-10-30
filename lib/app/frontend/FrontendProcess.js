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

const logHelper = LogHelper.getInstance()

/**
 * The FrontendProcess class.
 */
class FrontendProcess {
  constructor () {
    this.settings = AppSettings.getInstance()
    this.frontendSettings = this.settings.getFrontendSettings()
  }

  /**
   * Checks if frontend configuration is set up and runs the setup if not.
   */
  init () {
    const ip = this.frontendSettings.getIpAddress()
    const port = this.frontendSettings.getPort()
    const apiPort = this.frontendSettings.getApiPort()

    if (!ip || !port || !apiPort) {
      logHelper.logSetupNeeded()

      const setup = new FrontendSetup()
      return setup.run(false)
    }

    return Promise.resolve()
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
