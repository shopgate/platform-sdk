/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const UserSettings = require('../user/UserSettings')
const FrontendProcess = require('../app/frontend/FrontendProcess')
const FrontendSetup = require('../app/frontend/FrontendSetup')

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
      .command('frontend <action>', 'The frontend action to run. Possible actions are \'start\' and \'setup\'.')
      .description('Starts the frontend development environment.')
      .option('-t, --theme [value]', 'The name of the theme that you want to be compiled by webpack.')
      .option('-h, --host [value]', 'The URL or IP address of your local development environment.')
      .option('-p, --port [value]', 'The port to use for accessing the output via browser.')
      .action(this.run.bind(this))
  }

  /**
   * Runs the frontend process.
   * @param {string} The action to perform.
   * @param {Object} [options={}] The process options.
   */
  run (action, options = {}) {
    if (!UserSettings.getInstance().getSession().hasToken()) {
      throw new Error('not logged in')
    }

    switch (action) {
      default:
      case 'start': {
        const frontend = new FrontendProcess(options)
        frontend.run()
        break
      }
      case 'setup': {
        const setup = new FrontendSetup()
        setup.run()
        break
      }
    }
  }
}

module.exports = FrontendAction
