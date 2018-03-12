/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {fork} = require('child_process')
const {join, resolve} = require('path')
const logHelper = require('./LogHelper')

/**
 * The FrontendProcess class.
 */
class FrontendProcess {
  /**
   * FrontendProcess.
   * @param {Object} options The process options.
   * @param {FrontendSetup} frontendSetup
   * @param {AppSettings} appSettings
   */
  constructor (options, frontendSetup, appSettings) {
    this.options = options
    this.appSettings = appSettings
    this.frontendSetup = frontendSetup
    this.promise = null
    this.rapidProcess = null
    this.webpackProcess = null
  }

  /**
   * Checks if frontend configuration is set up and runs the setup if not.
   * @return {Promise}
   */
  async run () {
    this.frontendSettings = await this.appSettings.getFrontendSettings()
    this.ip = await this.frontendSettings.getIpAddress()
    this.port = await this.frontendSettings.getPort()
    this.apiPort = await this.frontendSettings.getApiPort()

    this.promise = Promise.resolve()

    if (!this.ip || !this.port || !this.apiPort) {
      logHelper.logSetupNeeded()
      this.promise = this.frontendSetup.run(false)
        .then(async () => {
          this.ip = await this.frontendSettings.getIpAddress()
          this.port = await this.frontendSettings.getPort()
          this.apiPort = await this.frontendSettings.getApiPort()
        })
    }

    return this.promise
      .then(async () => {
        this.rapidProcess = await this.rapidDevServer()
        this.webpackProcess = await this.webpackDevServer()
        this.setProcessExitHook()
      })
  }

  /**
   * Runs the Rapid Dev Server.
   */
  async rapidDevServer () {
    return fork(join(__dirname, './rapidDevServer'), {
      env: {
        ...process.env,
        appId: await this.appSettings.getId(),
        ...(await this.frontendSettings.loadSettings())
      }
    })
  }

  /**
   * Runs the Webpack Dev Server.
   */
  async webpackDevServer () {
    return fork(join(__dirname, './webpackStart'), {
      cwd: this.appSettings.getApplicationFolder(),
      env: {
        ...process.env,
        optionsHost: this.options.host || this.ip,
        optionsPort: this.options.port || this.port,
        theme: this.options.theme,
        extensions: JSON.stringify(this.settings.loadAttachedExtensions()),
        settings: JSON.stringify(await this.frontendSettings.loadSettings()),
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
      logHelper.logExit()
    })
  }
}

module.exports = FrontendProcess
