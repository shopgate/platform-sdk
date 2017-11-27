/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { fork } = require('child_process')
const { join, resolve } = require('path')
const AppSettings = require('../AppSettings')
const logHelper = require('./LogHelper')

/**
 * The FrontendProcess class.
 */
class FrontendProcess {
  /**
   * FrontendProcess.
   * @param {Object} options The process options.
   */
  constructor (options, frontendSetup) {
    this.options = options
    this.settings = AppSettings.getInstance()
    this.frontendSettings = this.settings.getFrontendSettings()
    this.ip = this.frontendSettings.getIpAddress()
    this.port = this.frontendSettings.getPort()
    this.apiPort = this.frontendSettings.getApiPort()
    this.frontendSetup = frontendSetup
    this.promise = null
    this.rapidProcess = null
    this.webpackProcess = null
  }

  /**
   * Checks if frontend configuration is set up and runs the setup if not.
   * @return {Promise}
   */
  run () {
    this.promise = Promise.resolve()

    if (!this.ip || !this.port || !this.apiPort) {
      logHelper.logSetupNeeded()
      this.promise = this.frontendSetup.run(false)
    }

    return this.promise
      .then(() => {
        this.rapidProcess = this.rapidDevServer()
        this.webpackProcess = this.webpackDevServer()
        this.setProcessExitHook()
      })
  }

  /**
   * Runs the Rapid Dev Server.
   */
  rapidDevServer () {
    return fork(join(__dirname, './rapidDevServer'), {
      env: {
        ...process.env,
        appId: this.settings.getId(),
        ...this.frontendSettings.settings
      }
    })
  }

  /**
   * Runs the Webpack Dev Server.
   */
  webpackDevServer () {
    return fork(join(__dirname, './webpackStart'), {
      env: {
        ...process.env,
        optionsHost: this.options.host || this.ip,
        optionsPort: this.options.port || this.port,
        theme: this.options.theme,
        settings: JSON.stringify(this.frontendSettings.settings),
        SDK_PATH: resolve(__dirname, '../../../')
      }
    })
  }

  /**
   * Terminates the child processes when the main process is ended.
   */
  setProcessExitHook () {
    process.on('SIGINT', () => {
      this.rapidProcess.kill('SIGINT')
      this.webpackProcess.kill('SIGINT')
      process.stdout.write('\x1Bc')
      logHelper.logExit()
    })
  }
}

module.exports = FrontendProcess
