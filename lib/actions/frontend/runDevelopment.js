/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { fork } = require('child_process')
const { join } = require('path')
const AppSettings = require('../../app/AppSettings')

const settings = AppSettings.getInstance()
const frontendSettings = settings.getFrontendSettings()

// Run the Rapid Dev Server.
fork(join(__dirname, '../../app/frontend/rapidDevServer'), {
  env: {
    appId: settings.getId(),
    ...frontendSettings.settings
  }
})
