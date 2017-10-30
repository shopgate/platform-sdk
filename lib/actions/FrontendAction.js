/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const UserSettings = require('../user/UserSettings')

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
      .description('Start the frontend development environment')
      .action(this.run.bind(this))
  }

  /**
   * Runs the frontend process.
   * @param {string} The action to perform.
   */
  run (action) {
    if (!UserSettings.getInstance().getSession().hasToken()) {
      throw new Error('not logged in')
    }

    switch (action) {
      default:
      case 'start':
        require('./frontend/runDevelopment')
        break
    }
  }
}

module.exports = FrontendAction
