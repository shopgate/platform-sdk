/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { join } = require('path')
const sinon = require('sinon')
const assert = require('assert')
const proxyquire = require('proxyquire')
const UserSettings = require('../../../lib/user/UserSettings')
const AppSettings = require('../../../lib/app/AppSettings')
const fsEx = require('fs-extra')

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

let questionSpyFail = false
const questionSpy = sinon.spy(() => {
  if (questionSpyFail) {
    return false
  }

  return []
})

const FrontendSetup = proxyquire('../../../lib/app/frontend/FrontendSetup', {
  request,
  './LogHelper': {
    logSetupLogo: () => {},
    getPrefix: () => {}
  },
  '../../logger': {
    plain: loggerSpy
  },
  inquirer,
  './setupQuestions': questionSpy
})

const userSettingsPath = join('build', 'usersettings')
const appSettingsPath = join('build', 'appsettings')
const appId = 'foobarTest'

const defaultConfig = {
  ip: '0.0.0.0',
  port: 8080,
  apiPort: 9666,
  hmrPort: 3000,
  remotePort: 8000,
  sourceMapsType: 'cheap-module-eval-source-map'
}
const runError = 'Had an error'

let frontendSetup

describe('FrontendSetup', () => {
  beforeEach(() => {
    process.env.USER_PATH = userSettingsPath
    process.env.APP_PATH = appSettingsPath

    fsEx.emptyDirSync(join(appSettingsPath, AppSettings.SETTINGS_FOLDER))
    new AppSettings().setId(appId).getFrontendSettings()._saveSettings(defaultConfig)
    fsEx.emptyDirSync(userSettingsPath)
    new UserSettings().setToken({})

    frontendSetup = new FrontendSetup()
    frontendSetup.defaultConfig = defaultConfig

    inquirer.prompt = setPromptBody()

    questionSpy.reset()
    questionSpyFail = false
  })

  afterEach((done) => {
    AppSettings.setInstance()
    UserSettings.setInstance()
    delete process.env.USER_PATH
    delete process.env.APP_PATH
    fsEx.remove(userSettingsPath, () => {
      fsEx.remove(appSettingsPath, done)
    })
  })

  describe('run()', () => {
    beforeEach(() => {
      frontendSetup.registerSettings = () => {}
      frontendSetup.save = () => {}
    })

    it('should throw an error if something goes wrong', (done) => {
      const spy = sinon.spy(frontendSetup, 'run')
      questionSpyFail = true
      frontendSetup.run()
        .then(() => {
          spy.reset()
          done('Did not throw!')
        })
        .catch((error) => {
          assert.ok(typeof error === 'string')
          sinon.assert.calledOnce(spy)
          spy.reset()
          done()
        })
    })

    it('should build the questions', (done) => {
      frontendSetup.run()
        .then(() => {
          sinon.assert.calledOnce(questionSpy)
          assert.ok(Array.isArray(questionSpy.returnValues[0]))
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

  describe('registerSettings()', () => {
    beforeEach(() => {
      frontendSetup.save = () => {}
    })

    it('should set the startPageUrl at the developer connector', (done) => {
      frontendSetup.dcClient = {
        setStartPageUrl: (actualAppId, startPageUrl, cb) => {
          assert.equal(actualAppId, appId)
          assert.equal(startPageUrl, `http://${defaultConfig.ip}:${defaultConfig.port}/`)
          cb()
        }
      }
      frontendSetup.run()
        .then(() => {
          done()
        })
        .catch((error) => {
          done(error)
        })
    })

    it('should throw an error if startPageUrl cant be set at the developer connector', (done) => {
      frontendSetup.dcClient = {
        setStartPageUrl: (actualAppId, startPageUrl, cb) => {
          assert.equal(actualAppId, appId)
          assert.equal(startPageUrl, `http://${defaultConfig.ip}:${defaultConfig.port}/`)
          cb(new Error('Something'))
        }
      }
      frontendSetup.run()
        .then(() => {
          assert.fail('Should throw an error')
        })
        .catch((err) => {
          assert.equal(err.message, 'Error while setting the start page url in the dev stack: Something')
        })
        .then(done, done)
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

  describe('save()', () => {
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
      sinon.assert.calledOnce(loggerSpy)
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
