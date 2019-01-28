/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const config = require('../../../lib/config')
const AppSettings = require('../../../lib/app/AppSettings')
const { SETTINGS_FOLDER } = require('../../../lib/app/Constants')
const UserSettings = require('../../../lib/user/UserSettings')

const appId = 'foobarTest'
let tempDir
let userSettingsPath
let appSettingsPath

/**
 * Creates an application environment for tests.
 */
const setupAppEnvironment = async () => {
  tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
  userSettingsPath = path.join(tempDir, 'user')
  appSettingsPath = path.join(tempDir, 'app')
  config.load({ userDirectory: userSettingsPath })

  process.env.USER_DIR = userSettingsPath
  process.env.APP_PATH = appSettingsPath
  process.env.appId = appId

  config.load({ userDirectory: userSettingsPath })

  await fsEx.emptyDir(path.join(appSettingsPath, SETTINGS_FOLDER))
  await new AppSettings(appSettingsPath).setId(appId)
  await new UserSettings().setToken({})
}

/**
 * Cleares the application environment after each teast.
 */
const clearAppEnviroment = async () => {
  delete process.env.USER_DIR
  delete process.env.APP_PATH
  delete process.env.appId

  await fsEx.remove(tempDir)
}

module.exports = {
  setupAppEnvironment,
  clearAppEnviroment
}
