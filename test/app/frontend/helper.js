/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {join} = require('path')
const UserSettings = require('../../../lib/user/UserSettings')
const AppSettings = require('../../../lib/app/AppSettings')
const fsEx = require('fs-extra')

const userSettingsPath = join('build', 'usersettings')
const appSettingsPath = join('build', 'appsettings')
const appId = 'foobarTest'
const { SETTINGS_FOLDER } = require('../../../lib/app/Constants')

/**
 * Creates an application environment for tests.
 */
const setupAppEnvironment = async () => {
  process.env.USER_PATH = userSettingsPath
  process.env.APP_PATH = appSettingsPath
  process.env.appId = appId

  await fsEx.emptyDir(join(appSettingsPath, SETTINGS_FOLDER))
  await new AppSettings(appSettingsPath).setId(appId)
  new UserSettings().setToken({})
}

/**
 * Cleares the application environment after each teast.
 */
const clearAppEnviroment = async () => {
  delete process.env.USER_PATH
  delete process.env.APP_PATH
  delete process.env.appId

  await fsEx.remove(userSettingsPath)
  await fsEx.remove(appSettingsPath)
}

module.exports = {
  setupAppEnvironment,
  clearAppEnviroment
}
