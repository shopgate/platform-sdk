/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { existsSync } = require('fs')
const { fork, spawn } = require('child_process')
const { join, resolve } = require('path')
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

    this.rapidProcess = await this.rapidDevServer()
    this.webpackProcess = await this.webpackDevServer()
  }

  /**
   * Runs the Rapid Dev Server.
   */
  async rapidDevServer () {
    return fork(join(__dirname, './rapidDevServer'), {
      env: {
        ...process.env,
        appId: process.env.SGCLOUD_RAPID_APP_ID || await this.appSettings.getId(),
        ...(await this.frontendSettings.loadSettings())
      }
    })
  }

  /**
   * Sleep N ms
   * @param ms
   * @returns {*}
   */
  async sleep (ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  /**
   * Runs the Webpack Dev Server.
   */
  async webpackDevServer () {
    const appFolder = this.appSettings.getApplicationFolder()
    const themePath = resolve(appFolder, 'themes', this.options.theme)

    /**
     * Use theme own webpack server implementation if server config file is present
     */
    if (existsSync(resolve(themePath, 'webpack.config.js'))) {
      await this.sleep(400)
      return spawn('npx', ['webpack-dev-server'], {
        stdio: 'inherit',
        cwd: themePath,
        env: {
          ...process.env,
          analyze: !!this.options.analyze,
          optionsHost: this.options.host || this.ip,
          optionsPort: this.options.port || this.port,
          theme: this.options.theme,
          extensions: JSON.stringify(await this.appSettings.loadAttachedExtensions()),
          settings: JSON.stringify(await this.frontendSettings.loadSettings()),
          SDK_PATH: resolve(__dirname, '../../../')
        }
      })
    }

    return fork(join(__dirname, './webpackStart'), {
      cwd: appFolder,
      env: {
        ...process.env,
        analyze: !!this.options.analyze,
        optionsHost: this.options.host || this.ip,
        optionsPort: this.options.port || this.port,
        theme: this.options.theme,
        extensions: JSON.stringify(await this.appSettings.loadAttachedExtensions()),
        settings: JSON.stringify(await this.frontendSettings.loadSettings()),
        SDK_PATH: resolve(__dirname, '../../../')
      }
    })
  }

  /**
   * Terminates the child processes when the main process is ended.
   */
  stop () {
    if (this.rapidProcess) this.rapidProcess.kill('SIGINT')
    if (this.webpackProcess) this.webpackProcess.kill('SIGINT')
    logHelper.logExit()
  }
}

module.exports = FrontendProcess
