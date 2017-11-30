/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { join } = require('path')
const UserSettings = require('../../../lib/user/UserSettings')
const AppSettings = require('../../../lib/app/AppSettings')
const fsEx = require('fs-extra')

const userSettingsPath = join('build', 'usersettings')
const appSettingsPath = join('build', 'appsettings')
const appId = 'foobarTest'

/**
 * Creates an application environment for tests.
 * @param {Function} callback Anything local that should be called in beforeEach afterwards.
 */
const setupAppEnvironment = (callback = () => {}) => {
  process.env.USER_PATH = userSettingsPath
  process.env.APP_PATH = appSettingsPath
  process.env.appId = appId

  const appSettings = new AppSettings()
  fsEx.emptyDirSync(join(appSettingsPath, AppSettings.SETTINGS_FOLDER))
  appSettings.setId(appId).setAttachedExtensions({}).save().init()
  AppSettings.setInstance(appSettings)
  UserSettings.getInstance().getSession().token = {}

  callback()
}

/**
 * Cleares the application environment after each teast.
 * @param {Function} callback Anything local that should be called in afterEach afterwards.
 */
const clearAppEnviroment = (callback = () => {}) => {
  UserSettings.setInstance()

  delete process.env.USER_PATH
  delete process.env.APP_PATH
  delete process.env.appId

  fsEx.remove(userSettingsPath, () => {
    fsEx.remove(appSettingsPath, callback)
  })
}

module.exports = {
  setupAppEnvironment,
  clearAppEnviroment
}
