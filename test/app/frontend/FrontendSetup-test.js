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
const assert = require('assert')
const UserSettings = require('../../../lib/user/UserSettings')
const AppSettings = require('../../../lib/app/AppSettings')
const FrontendSetup = require('../../../lib/app/frontend/FrontendSetup')

const userSettingsPath = join('test', 'usersettings')
const appSettingsPath = join('test', 'appsettings')
const appId = 'foobarTest'

let frontendSetup
const defaultConfig = {
  ip: '0.0.0.0',
  port: 8080,
  apiPort: 9666,
  hmrPort: 3000,
  remotePort: 8000,
  sourceMapsType: 'cheap-module-eval-source-map',
  accessToken: 'abcabcabcabc'
}
const runError = 'Had an error'

describe('FrontendSetup', () => {
  beforeEach(() => {
    process.env.USER_PATH = userSettingsPath
    process.env.APP_PATH = appSettingsPath

    const appSettings = new AppSettings()
    appSettings.frontendSettings = defaultConfig
    mkdirp.sync(join(appSettingsPath, AppSettings.SETTINGS_FOLDER))
    appSettings.setId(appId).setAttachedExtensions({}).save().init()
    AppSettings.setInstance(appSettings)
    UserSettings.getInstance().getSession().token = {}

    frontendSetup = new FrontendSetup()
    frontendSetup.defaultConfig = defaultConfig
    frontendSetup.logHelper.logSetupLogo = () => {}

    frontendSetup.save = () => {}
    frontendSetup.prompt = (questions = []) =>
      questions
        ? Promise.resolve({ ...defaultConfig, confirmed: true })
        : Promise.reject(runError)
  })

  afterEach((done) => {
    UserSettings.setInstance()
    delete process.env.USER_PATH
    rimraf(userSettingsPath, () => {
      rimraf(appSettingsPath, done)
    })
  })

  describe('FrontendSetup.run()', () => {
    beforeEach(() => {
      frontendSetup.registerSettings = () => {}
    })

    it('should throw an error if something goes wrong', async () => {
      try {
        const spy = sinon.spy(frontendSetup, 'run')
        frontendSetup.getQuestions = () => false

        await frontendSetup.run()
        assert.ok(spy.calledOnce)
        assert.ok(spy.threw())
        spy.restore()
      } catch (error) {}
    })

    it('should build the questions', async () => {
      const spy = sinon.spy(frontendSetup, 'getQuestions')

      await frontendSetup.run()
      assert.ok(spy.calledOnce)
      assert.ok(Array.isArray(spy.returnValues[0]))
      spy.restore()
    })

    it('should inquire the answers', async () => {
      const spy = sinon.spy(frontendSetup, 'prompt')

      await frontendSetup.run()
      assert.ok(spy.calledOnce)
      spy.restore()
    })

    it('should register the settings', async () => {
      const spy = sinon.spy(frontendSetup, 'registerSettings')

      await frontendSetup.run()
      assert.ok(spy.calledOnce)
      spy.restore()
    })

    it('should save the settings', async () => {
      const spy = sinon.spy(frontendSetup, 'save')

      await frontendSetup.run()
      assert.ok(spy.calledOnce)
      spy.restore()
    })
  })

  describe('FrontendSetup.registerSettings()', () => {
    it('should throw an error if settings not confirmed', (done) => {
      frontendSetup.prompt = (questions = []) =>
        questions
          ? Promise.resolve({ ...defaultConfig, confirmed: false })
          : Promise.reject(runError)

      frontendSetup.run()
        .then(() => {
          done('Did not throw!')
        })
        .catch((error) => {
          assert.equal(error.message, 'Sorry, you canceled the setup! Please try again.')
          done()
        })
    })
  })
})
