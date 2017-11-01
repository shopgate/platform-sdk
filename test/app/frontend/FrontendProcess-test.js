/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { join } = require('path')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const sinon = require('sinon')
const UserSettings = require('../../../lib/user/UserSettings')
const AppSettings = require('../../../lib/app/AppSettings')
const FrontendProcess = require('../../../lib/app/frontend/FrontendProcess')

const userSettingsPath = join('test', 'usersettings')
const appSettingsPath = join('test', 'appsettings')
const appId = 'foobarTest'

let frontendProcess

describe('FrontendProcess', () => {
  beforeEach(() => {
    process.env.USER_PATH = userSettingsPath
    process.env.APP_PATH = appSettingsPath

    const appSettings = new AppSettings()
    mkdirp.sync(join(appSettingsPath, AppSettings.SETTINGS_FOLDER))
    appSettings.setId(appId).setAttachedExtensions({}).save().init()
    AppSettings.setInstance(appSettings)
    UserSettings.getInstance().getSession().token = {}

    frontendProcess = new FrontendProcess()
  })

  afterEach((done) => {
    UserSettings.setInstance()
    delete process.env.USER_PATH
    rimraf(userSettingsPath, () => {
      rimraf(appSettingsPath, done)
    })
  })

  describe('FrontendProcess.init()', () => {
    beforeEach(() => {
      frontendProcess.frontendSetup.run = () => Promise.resolve()
      frontendProcess.logHelper.logSetupNeeded = () => {}
    })

    it('should run the frontend setup if nothing is set', () => {
      frontendProcess.rapidDevServer = () => {}
      const runSpy = sinon.spy(frontendProcess.frontendSetup, 'run')

      frontendProcess.init({ rapid: {} })
      sinon.assert.calledOnce(runSpy)
      runSpy.restore()
    })

    it('it should skip the setup if variables are set', () => {
      frontendProcess.rapidDevServer = () => {}
      const runSpy = sinon.spy(frontendProcess.frontendSetup, 'run')

      frontendProcess.ip = true
      frontendProcess.port = true
      frontendProcess.apiPort = true

      frontendProcess.init({ rapid: {} })
      sinon.assert.notCalled(runSpy)
      runSpy.restore()
    })

    it('should not start the rapid dev server if no variables are set', () => {
      frontendProcess.rapidDevServer = () => {}
      const rapidDevServerSpy = sinon.spy(frontendProcess, 'rapidDevServer')

      frontendProcess.init({ rapid: {} })
      sinon.assert.notCalled(rapidDevServerSpy)
    })

    it('should start the call the rapid dev server if all is set', () => {
      frontendProcess.rapidDevServer = () => {}
      const rapidDevServerSpy = sinon.spy(frontendProcess, 'rapidDevServer')

      frontendProcess.ip = true
      frontendProcess.port = true
      frontendProcess.apiPort = true

      frontendProcess.init({ rapid: {} })
        .then(() => {
          sinon.assert.calledOnce(rapidDevServerSpy)
        })
    })
  })
})
