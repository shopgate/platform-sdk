/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { fork } = require('child_process')
const { join } = require('path')
const AppSettings = require('../../app/AppSettings')

let instance

class StartAction {
  static getInstance () {
    if (!instance) instance = new StartAction()
    return instance
  }

  cmd (commander) {
    commander
      .command('frontend start')
      .description('start the frontend sdk')
      .action(StartAction.getInstance().run)
  }

  run () {
    const appSettings = AppSettings.getInstance()
    const frontendSettings = appSettings.getFrontendSettings()

    fork(join(__dirname, '../../app/frontend/rapidDevServer'), {
      env: {
        appId: appSettings.getId(),
        ...frontendSettings.settings
      }
    })
  }
}

module.exports = StartAction.getInstance()
