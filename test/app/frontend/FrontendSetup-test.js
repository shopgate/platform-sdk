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

let frontendSettings = null
let appSettings = {
  getFrontendSettings: () => frontendSettings
}

let frontendSetup

describe('FrontendSetup', () => {
  beforeEach(() => {
    process.env.USER_PATH = userSettingsPath
    process.env.APP_PATH = appSettingsPath

    appSettings.getId = () => {}
    frontendSettings = {}

    frontendSettings.getIpAddress = () => Promise.resolve(defaultConfig.ip)
    frontendSettings.getPort = () => Promise.resolve(defaultConfig.port)
    frontendSettings.getApiPort = () => Promise.resolve(defaultConfig.apiPort)
    frontendSettings.getHmrPort = () => Promise.resolve(defaultConfig.hmrPort)
    frontendSettings.getRemotePort = () => Promise.resolve(defaultConfig.remotePort)
    frontendSettings.getSourceMapsType = () => Promise.resolve(defaultConfig.sourceMapsType)
    frontendSettings.setIpAddress = () => Promise.reject(new Error('error'))
    frontendSettings.setPort = () => Promise.reject(new Error('error'))
    frontendSettings.setApiPort = () => Promise.reject(new Error('error'))
    frontendSettings.setHmrPort = () => Promise.reject(new Error('error'))
    frontendSettings.setRemotePort = () => Promise.reject(new Error('error'))
    frontendSettings.setSourceMapsType = () => Promise.reject(new Error('error'))

    frontendSetup = new FrontendSetup(null, appSettings)
    frontendSetup.defaultConfig = defaultConfig

    inquirer.prompt = setPromptBody()

    questionSpyFail = false
  })

  afterEach((done) => {
    delete process.env.USER_PATH
    delete process.env.APP_PATH
    fsEx.remove(userSettingsPath, () => {
      fsEx.remove(appSettingsPath, done)
    })
  })

  describe('run()', () => {
    beforeEach(() => {
      appSettings.getId = () => 'shop_10006'

      frontendSetup.registerSettings = () => {}
      frontendSetup.save = () => {}
    })

    it('should throw an error if something goes wrong', (done) => {
      const spy = sinon.spy(frontendSetup, 'run')
      questionSpyFail = true
      frontendSetup.run()
        .then(() => {
          spy.restore()
          done('Did not throw!')
        })
        .catch((error) => {
          assert.ok(typeof error === 'string')
          sinon.assert.calledOnce(spy)
          spy.restore()
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
          spy.restore()
          done()
        })
        .catch(error => done(error))
    })

    it('should register the settings', (done) => {
      const spy = sinon.spy(frontendSetup, 'registerSettings')
      frontendSetup.run()
        .then(() => {
          assert.ok(spy.calledOnce)
          spy.restore()
          done()
        })
        .catch(error => done(error))
    })

    it('should save the settings', (done) => {
      const spy = sinon.spy(frontendSetup, 'save')
      frontendSetup.run()
        .then(() => {
          assert.ok(spy.calledOnce)
          spy.restore()
          done()
        })
        .catch(error => done(error))
    })
  })

  describe('registerSettings()', () => {
    beforeEach(() => {
      appSettings.getId = () => appId
      frontendSetup.save = () => {}
    })

    it('should set the startPageUrl at the developer connector', () => {
      frontendSetup.dcClient = {
        setStartPageUrl: (actualAppId, startPageUrl, cb) => {
          assert.equal(actualAppId, appId)
          assert.equal(startPageUrl, `http://${defaultConfig.ip}:${defaultConfig.port}/`)
          cb()
        }
      }
      return frontendSetup.run()
        .catch((err) => assert.ifError(err))
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
      loggerSpy.restore()

      frontendSettings.setIpAddress = (ip) => {
        assert.equal(ip, defaultConfig.ip)
        return Promise.resolve()
      }

      frontendSettings.setPort = (port) => {
        assert.equal(port, defaultConfig.port)
        return Promise.resolve()
      }

      frontendSettings.setApiPort = (apiPort) => {
        assert.equal(apiPort, defaultConfig.apiPort)
        return Promise.resolve()
      }

      frontendSettings.setHmrPort = (hmrPort) => {
        assert.equal(hmrPort, defaultConfig.hmrPort)
        return Promise.resolve()
      }

      frontendSettings.setRemotePort = (remotePort) => {
        assert.equal(remotePort, defaultConfig.remotePort)
        return Promise.resolve()
      }

      frontendSettings.setSourceMapsType = (sourceMapsType) => {
        assert.equal(sourceMapsType, defaultConfig.sourceMapsType)
        return Promise.resolve()
      }
    })

    afterEach(() => {
      saveSpy.restore()
      loggerSpy.restore()
    })

    it('should save the settings', () => {
      return frontendSetup.save(defaultConfig)
        .catch(err => assert.ifError(err))
    })

    it('should show two console logs on success', () => {
      return frontendSetup.save(defaultConfig).then(() => {
        sinon.assert.calledOnce(loggerSpy)
      })
    })

    it('should throw if something went wrong', (done) => {
      frontendSetup.appSettings.getFrontendSettings = () => {
        throw new Error('error')
      }

      frontendSetup.save(defaultConfig).catch((err) => {
        assert.equal(err.message, 'error')
        done()
      })
    })
  })
})
