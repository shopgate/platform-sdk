/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const inquirer = require('inquirer')
const os = require('os')
const { bold, red, green } = require('chalk')
const request = require('request')
const AppSettings = require('../AppSettings')
const LogHelper = require('./LogHelper')

const logHelper = LogHelper.getInstance()
const prefix = logHelper.getPrefix()

/**
 * The FrontendSetup class.
 */
class FrontendSetup {
  constructor () {
    this.settings = AppSettings.getInstance()
    this.defaultConfig = this.getDefaultConfig()
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

    const questions = [
      {
        type: 'input',
        name: 'ip',
        message: 'Which IP address should the app connect to?',
        default: this.defaultConfig.ip
      },
      {
        type: 'input',
        name: 'port',
        message: 'On which port should the app run?',
        default: this.defaultConfig.port
      },
      {
        type: 'input',
        name: 'apiPort',
        message: 'On which port should the Rapid API run?',
        default: this.defaultConfig.apiPort
      },
      {
        type: 'input',
        name: 'hmrPort',
        message: 'On which port should the HMR (Hot Module Replacement) run?',
        default: this.defaultConfig.hmrPort
      },
      {
        type: 'input',
        name: 'remotePort',
        message: 'On which port should the remote dev server (redux) run?',
        default: this.defaultConfig.remotePort
      },
      {
        type: 'input',
        name: 'sourceMapsType',
        message: 'Please specify your development sourcemap type:',
        default: this.defaultConfig.sourceMapsType
      },
      {
        type: 'input',
        name: 'accessToken',
        message: 'For gathering the startpage, please provide us your RAPID access token.',
        default: this.defaultConfig.accessToken
      },
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Are these settings correct?',
        default: true
      }
    ]

    await inquirer
      .prompt(questions)
      .then(this.registerSettings.bind(this))
      .then(this.save.bind(this))
      .catch(error => {
        throw error
      })
  }

  /**
   * Registers the settings with the RAPID server.
   * @param {Object} answers The provided answers.
   * @return {Object}
   */
  registerSettings (answers) {
    const { confirmed, ip, port } = answers
    const appId = this.settings.getId()

    if (!confirmed) {
      console.log(`\n${red(bold('Sorry, you canceled the setup!'))} Please try again.\n\n`)
      process.exit(1)
    }

    const startPageUrl = `http://${ip}:${port}/`
    const url = `https://jenkins.shopgate.services:8443/buildByToken/buildWithParameters?job=SGXS_frontend_start_page_url&token=${answers.accessToken}&START_PAGE_URL=${encodeURIComponent(startPageUrl)}&SHOP_NUMBER=${appId}`

    request(url, (error, response, body) => {
      if (error) {
        throw error
      }

      if (response.statusCode !== 201) {
        throw new Error(`Wrong statusCode ${response.statusCode}. Message: ${body}`)
      }
    })

    return answers
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

      console.log(`\n${green('SUCCESSS')}: Your ${prefix} project is now ready!`)
      console.log(`${bold('ATTENTION')}: It may take a few minutes to connect your IP with the ${prefix}!\n`)
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
