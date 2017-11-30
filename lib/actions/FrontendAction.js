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
const ThemeConfigWatcher = require('../app/frontend/ThemeConfigWatcher')

/**
 * The FrontendAction class.
 */
class FrontendAction {
  /**
   * Registers the frontend command.
   * @param {Command} commander Instance of the commander module.
   */
  register (commander) {
    commander
      .command('frontend <action>')
      .description('The frontend action to run. Possible actions are \'start\' and \'setup\'.')
      .option('-t, --theme [value]', 'The name of the theme that you want to be compiled by webpack.')
      .option('-h, --host [value]', 'The URL or IP address of your local development environment.')
      .option('-p, --port [value]', 'The port to use for accessing the output via browser.')
      .action(this.run.bind(this))
  }

  /**
   * Runs the frontend process.
   * @param {string} action The action to perform.
   * @param {Object} [options={}] The process options.
   */
  run (action, options = {}) {
    if (!UserSettings.getInstance().getSession().getToken()) {
      throw new Error('not logged in')
    }
    const dcClient = new DcHttpClient(UserSettings.getInstance())
    const themeConfigWatcher = new ThemeConfigWatcher()
    const frontendSetup = new FrontendSetup(dcClient)
    switch (action) {
      default:
      case 'start': {
        const frontend = new FrontendProcess(options, frontendSetup)
        frontend.run()
          .then(() => {
            themeConfigWatcher.start(() => {
              themeConfigWatcher.on('configChange', (config) => this.themeChanged(dcClient, config))
            })
          })
          .catch(error => {
            console.error(error)
            process.exit(1)
          })
        break
      }
      case 'setup': {
        frontendSetup.run()
          .catch(error => {
            console.error(error)
            process.exit(1)
          })
        break
      }
    }

    process.on('SIGINT', () => {
      themeConfigWatcher.stop(() => {
        logger.info('SDK connection closed')
      })
    })
  }

  themeChanged (dcClient, config, cb = () => {}) {
    logger.info(`Generating new theme config for '${config.file.id}'`)
    async.retry({
      times: 5,
      interval: (count) => 100 * Math.pow(2, count)
    }, (acb) => {
      dcClient.generateExtensionConfig(config.file, AppSettings.getInstance().getId(), (err, extConfig) => {
        if (err) return acb(new Error(`Could not generate Config for '${config.file.id}'`))
        return acb(null, extConfig)
      })
    }, (err, extConfig) => {
      if (err) return
      if (extConfig.frontend) {
        fsEx.outputJsonSync(path.join('', config.path, 'config', 'app.json'), extConfig.frontend, {spaces: 2})
        logger.info(`Updated theme config ${config.file.id}`)
      }
      cb()
    })
  }
}

module.exports = FrontendAction
