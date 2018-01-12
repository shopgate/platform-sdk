/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
const fsEx = require('fs-extra')
const async = require('neo-async')
const path = require('path')
const logger = require('../logger')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const FrontendProcess = require('../app/frontend/FrontendProcess')
const FrontendSetup = require('../app/frontend/FrontendSetup')
const DcHttpClient = require('../DcHttpClient')
const utils = require('../utils/utils')

/**
 * The FrontendAction class.
 */
class FrontendAction {
  constructor () {
    this.appSettings = new AppSettings().validate()
    this.userSettings = new UserSettings().validate()
    this.settingsFolder = path.join(this.appSettings.getApplicationFolder(), AppSettings.SETTINGS_FOLDER)
    this.dcClient = new DcHttpClient(this.userSettings)
    this.frontendSetup = new FrontendSetup(this.dcClient, this.appSettings)
  }

  /**
   * Registers the frontend command.
   * @param {Command} caporal Instance of the commander module.
   */
  static register (caporal) {
    caporal
      .command('frontend start')
      .description('Start the webpack for the frontend development')
      .option('-t, --theme [value]', 'The name of the theme that you want to be compiled by webpack.')
      .option('-h, --host [value]', 'The URL or IP address of your local development environment.')
      .option('-p, --port [value]', 'The port to use for accessing the output via browser.')
      .action((args, options) => new FrontendAction().run('start', args, options))

    caporal
      .command('frontend setup')
      .description('Change your settings for the frontend development')
      .action((args, options) => new FrontendAction().run('setup', args, options))
  }

  /**
   * Runs the frontend process.
   * @param {string} action The action to perform.
   * @param {Object} [args={}] The process args.
   * @param {Object} [options={}] The process options.
   */
  run (action, args, options = {}) {
    this.userSettings = new UserSettings().validate()
    this.appSettings = new AppSettings().validate()

    const pid = utils.previousProcess('frontend', this.settingsFolder)
    if (pid) throw new Error(`Frontend process is already running with pid: ${pid}. Please quit this process first.`)

    switch (action) {
      default:
      case 'start': {
        if (!options.theme) throw new Error('Please pass the folder of the desired theme. Run `sgcloud frontend start -t <foldername of the theme>`')
        const templateFolder = path.join(this.appSettings.getApplicationFolder(), AppSettings.THEMES_FOLDER, options.theme)
        if (!fsEx.existsSync(templateFolder)) throw new Error(`Can't find theme ${options.theme}. Please make sure you passed the right theme.`)

        const frontend = new FrontendProcess(options, this.frontendSetup, this.appSettings)
        this.updateThemeConfig(templateFolder)
          .then(() => frontend.run())
          .then(() => {
            utils.setProcessFile('frontend', this.settingsFolder, process.pid)
          })
          .catch(error => {
            console.error(error)
            process.exit(1)
          })
        break
      }
      case 'setup': {
        this.frontendSetup.run()
          .catch(error => {
            console.error(error)
            process.exit(1)
          })
        break
      }
    }

    process.on('SIGINT', () => {
      utils.deleteProcessFile('frontend', this.settingsFolder)
    })
  }

  updateThemeConfig (templateFolder) {
    logger.info(`Generating theme config`)
    const extensionConfigFile = fsEx.readJSONSync(path.join(templateFolder, 'extension-config.json'))
    return new Promise((resolve, reject) => {
      async.retry({
        times: 5,
        interval: (count) => 100 * Math.pow(2, count)
      }, (acb) => {
        this.dcClient.generateExtensionConfig(extensionConfigFile, this.appSettings.getId(), (err, extConfig) => {
          if (err) return acb(new Error('Could not generate config: ' + err.message))
          return acb(null, extConfig)
        })
      }, (err, extConfig) => {
        if (err) return reject(err)
        if (!extConfig.frontend) {
          logger.warn('No config with the destination \'frontend\' found')
          return resolve()
        }

        const appJsonFile = path.join(templateFolder, 'config', 'app.json')
        fsEx.outputJsonSync(appJsonFile, extConfig.frontend, {spaces: 2})
        logger.info(`Updated theme config`)
        resolve()
      })
    })
  }
}

module.exports = FrontendAction
