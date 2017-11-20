/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const inquirer = require('inquirer')
const os = require('os')
const { bold, green } = require('chalk')
const request = require('request')
const AppSettings = require('../AppSettings')
const logHelper = require('./LogHelper')
const setupQuestions = require('./setupQuestions')
const logger = require('../../logger')

/**
 * The FrontendSetup class.
 */
class FrontendSetup {
  constructor () {
    this.settings = AppSettings.getInstance()
  }

  /**
   * Runs the setup process.
   * @param {boolean} [showWelcomeMessage=true] If a welcome message should be shown.
   * @return {Promise}
   */
  async run (showWelcomeMessage = true) {
    if (showWelcomeMessage) {
      logHelper.logSetupLogo()
    }

    await inquirer.prompt(setupQuestions(this.getDefaultConfig()))
      .then(this.registerSettings.bind(this))
      .then(this.save.bind(this))
      .catch(error => {
        throw error
      })
  }

  /**
   * Creates the request URL.
   * @param {string} ip The IP to create the startPageUrl
   * @param {Number} port The port to create the startPageUrl
   * @param {string} accessToken The Jenkins access token.
   * @param {string} appId The app id.
   * @return {string}
   */
  createRequestUrl (ip, port, accessToken, appId) {
    const startPageUrl = encodeURIComponent(`http://${ip}:${port}/`)

    return `https://jenkins.shopgate.services:8443/buildByToken/buildWithParameters?` +
      `job=SGXS_frontend_start_page_url` +
      `&token=${accessToken}` +
      `&START_PAGE_URL=${startPageUrl}` +
      `&SHOP_NUMBER=${appId}`
  }

  /**
   * Registers the settings with the RAPID server.
   * @param {Object} answers The provided answers.
   * @return {Object}
   */
  async registerSettings (answers) {
    const { confirmed, ip, port, accessToken } = answers
    const appId = this.settings.getId()

    if (!confirmed) {
      throw new Error('Sorry, you canceled the setup! Please try again.')
    }

    const url = this.createRequestUrl(ip, port, accessToken, appId)

    await request(url, this.handleRequestResponse.bind(this))

    return answers
  }

  /**
   * Handles the jenkins request response
   * @param {Object} error An error.
   * @param {Object} response The response object.
   * @param {string} body The request body.
   */
  handleRequestResponse (error, response, body) {
    if (error) {
      throw error
    }

    if (response.statusCode !== 201) {
      throw new Error(`Wrong statusCode ${response.statusCode}. Message: ${body}`)
    }
  }

  /**
   * Saves the input to the configuration file.
   * @param {Object} answers The provided answers.
   */
  save (answers) {
    try {
      this.settings.getFrontendSettings()
        .setIpAddress(answers.ip)
        .setPort(parseInt(answers.port, 10))
        .setApiPort(parseInt(answers.apiPort, 10))
        .setHmrPort(parseInt(answers.hmrPort, 10))
        .setRemotePort(parseInt(answers.remotePort, 10))
        .setSourceMapsType(answers.sourceMapsType)
        .setAccessToken(answers.accessToken)

      this.settings.save()

      logger.plain(`\n${green('SUCCESSS')}: Your ${logHelper.getPrefix()} project is now ready!`)
      logger.plain(`${bold('ATTENTION')}: It may take a few minutes to connect your IP with the ${logHelper.getPrefix()}!\n`)
    } catch (error) {
      throw error
    }
  }

  /**
   * Returns the client's local IP address.
   * @return {string}
   */
  getLocalIpAdresses () {
    // Resolve the local area network ip.
    const ifaces = os.networkInterfaces()
    let localIp = '127.0.0.1'

    Object.keys(ifaces).forEach((ifname) => {
      ifaces[ifname].forEach((iface) => {
        if (iface.family !== 'IPv4' || iface.internal !== false) {
          // Skip over internal and non-ipv4 addresses
          return
        }

        localIp = iface.address
      })
    })

    return localIp
  }

  /**
   * Builds and returns the default configuration.
   * @return {Object}
   */
  getDefaultConfig () {
    const settings = this.settings.getFrontendSettings()

    return {
      ip: settings.getIpAddress() || this.getLocalIpAdresses(),
      port: settings.getPort() || 8080,
      apiPort: settings.getApiPort() || 9666,
      hmrPort: settings.getHmrPort() || 3000,
      remotePort: settings.getRemotePort() || 8000,
      sourceMapsType: settings.getSourceMapsType() || 'cheap-module-eval-source-map',
      accessToken: this.settings.getFrontendSettings().getAccessToken()
    }
  }
}

module.exports = FrontendSetup
