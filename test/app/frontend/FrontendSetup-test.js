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
const proxyquire = require('proxyquire')
const UserSettings = require('../../../lib/user/UserSettings')
const AppSettings = require('../../../lib/app/AppSettings')

let requestSpyFail = false
let requestStatusCode = 201
const requestSpyError = 'Request failed!'
const requestSpyBody = 'Some Body content'
const request = sinon.spy(function (url, callback) {
  if (requestSpyFail) {
    callback(new Error(requestSpyError))
  }

  callback(null, { statusCode: requestStatusCode }, requestSpyBody)
})
const loggerSpy = sinon.spy()

const setPromptBody = (confirmed = true) => (questions = []) =>
  questions
    ? Promise.resolve({ ...defaultConfig, confirmed })
    : Promise.reject(runError)

const inquirer = {
  prompt: setPromptBody()
}

const FrontendSetup = proxyquire('../../../lib/app/frontend/FrontendSetup', {
  request,
  './LogHelper': {
    logSetupLogo: () => {},
    getPrefix: () => {}
  },
  '../../logger': {
    plain: loggerSpy
  },
  inquirer
})

const userSettingsPath = join('test', 'usersettings')
const appSettingsPath = join('test', 'appsettings')
const appId = 'foobarTest'

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

let frontendSetup

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

    inquirer.prompt = setPromptBody()
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
      frontendSetup.save = () => {}
    })

    it('should throw an error if something goes wrong', (done) => {
      const spy = sinon.spy(frontendSetup, 'run')
      frontendSetup.getQuestions = () => false
      frontendSetup.run()
        .then(() => {
          spy.reset()
          done('Did not throw!')
        })
        .catch((error) => {
          assert.ok(typeof error === 'string')
          assert.ok(spy.calledOnce)
          spy.reset()
          done()
        })
    })

    it('should build the questions', (done) => {
      const spy = sinon.spy(frontendSetup, 'getQuestions')
      frontendSetup.run()
        .then(() => {
          assert.ok(spy.calledOnce)
          assert.ok(Array.isArray(spy.returnValues[0]))
          spy.reset()
          done()
        })
        .catch(error => done(error))
    })

    it('should inquire the answers', (done) => {
      const spy = sinon.spy(inquirer, 'prompt')
      frontendSetup.run()
        .then(() => {
          assert.ok(spy.calledOnce)
          spy.reset()
          done()
        })
        .catch(error => done(error))
    })

    it('should register the settings', (done) => {
      const spy = sinon.spy(frontendSetup, 'registerSettings')
      frontendSetup.run()
        .then(() => {
          assert.ok(spy.calledOnce)
          spy.reset()
          done()
        })
        .catch(error => done(error))
    })

    it('should save the settings', (done) => {
      const spy = sinon.spy(frontendSetup, 'save')
      frontendSetup.run()
        .then(() => {
          assert.ok(spy.calledOnce)
          spy.reset()
          done()
        })
        .catch(error => done(error))
    })
  })

  describe('FrontendSetup.registerSettings()', () => {
    beforeEach(() => {
      frontendSetup.save = () => {}
    })

    it('should call the createRequestUrl()', (done) => {
      const requestUrlSpy = sinon.spy(frontendSetup, 'createRequestUrl')
      frontendSetup.run()
        .then(() => {
          sinon.assert.calledOnce(requestUrlSpy)
          request.reset()
          requestUrlSpy.reset()
          done()
        })
        .catch((error) => {
          done(error)
        })
    })

    it('should process a request to trigger the jenkins job', (done) => {
      frontendSetup.run()
        .then(() => {
          sinon.assert.calledOnce(request)
          request.reset()
          done()
        })
        .catch((error) => {
          done(error)
        })
    })

    it('should throw an error if settings not confirmed', (done) => {
      inquirer.prompt = setPromptBody(false)
      frontendSetup.run()
        .then(() => {
          done('Did not throw!')
        })
        .catch((error) => {
          sinon.assert.notCalled(request)
          assert.equal(error.message, 'Sorry, you canceled the setup! Please try again.')
          request.reset()
          done()
        })
    })
  })

  describe('FrontendSetup.handleRequestResponse()', () => {
    beforeEach(() => {
      frontendSetup.save = () => {}
    })

    it('should not throw an error if all is good', (done) => {
      const handlerSpy = sinon.spy(frontendSetup, 'handleRequestResponse')

      frontendSetup.run()
        .then(() => {
          assert.ok(handlerSpy.calledOnce)
          handlerSpy.reset()
          request.reset()
          done()
        })
        .catch((error) => {
          handlerSpy.reset()
          request.reset()
          done(error)
        })
    })

    it('should throw if an error happened', (done) => {
      const handlerSpy = sinon.spy(frontendSetup, 'handleRequestResponse')
      requestSpyFail = true

      frontendSetup.run()
        .then(() => {
          handlerSpy.reset()
          request.reset()
          requestSpyFail = false
          done('Did not throw!')
        })
        .catch((error) => {
          assert.equal(error.message, requestSpyError)
          requestSpyFail = false
          handlerSpy.reset()
          request.reset()
          done()
        })
    })

    it('should throw if the status code is wrong', (done) => {
      const handlerSpy = sinon.spy(frontendSetup, 'handleRequestResponse')
      requestStatusCode = 300

      frontendSetup.run()
        .then(() => {
          handlerSpy.reset()
          request.reset()
          requestStatusCode = 201
          done('Did not throw!')
        })
        .catch((error) => {
          assert.equal(error.message, `Wrong statusCode ${requestStatusCode}. Message: ${requestSpyBody}`)
          handlerSpy.reset()
          request.reset()
          requestStatusCode = 201
          done()
        })
    })
  })

  describe('FrontendSetup.createRequestUrl()', () => {
    beforeEach(() => {
      frontendSetup.save = () => {}
    })

    it('should create the request url', () => {
      const ip = '0.0.0.0'
      const port = 9666
      const accessToken = 'abcabcabcabc'
      const appId = 'sometest'
      const url = frontendSetup.createRequestUrl(ip, port, accessToken, appId)

      assert.equal(url, frontendSetup.createRequestUrl(ip, port, accessToken, appId))
      assert.ok(typeof url === 'string')
    })
  })

  describe('FrontendSetup.save()', () => {
    let saveSpy

    beforeEach(() => {
      saveSpy = sinon.spy()
      loggerSpy.reset()
    })

    afterEach(() => {
      saveSpy.reset()
      loggerSpy.reset()
    })

    it('should save the settings', () => {
      frontendSetup.save(defaultConfig)
      const saveSettings = frontendSetup.settings.getFrontendSettings().settings
      assert.equal(JSON.stringify(saveSettings), JSON.stringify(defaultConfig))
    })

    it('should show two console logs on success', () => {
      frontendSetup.save(defaultConfig)
      sinon.assert.calledTwice(loggerSpy)
    })

    it('should throw if something went wrong', (done) => {
      frontendSetup.settings.getFrontendSettings = () => {
        throw new Error('error')
      }

      try {
        frontendSetup.save(defaultConfig)
        done('Did not throw!')
      } catch (error) {
        assert.equal(error.message, 'error')
        done()
      }
    })
  })
})
