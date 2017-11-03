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
const proxyquire = require('proxyquire')

const forkFailError = 'Fork failed!'
let forkFail = false
let forkSpy
const logSetupNeededSpy = sinon.spy()

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

    const FrontendProcess = proxyquire('../../../lib/app/frontend/FrontendProcess', {
      child_process: {
        fork: forkSpy = sinon.spy(() => {
          if (forkFail) {
            throw new Error(forkFailError)
          }
        })
      },
      './LogHelper': {
        logSetupNeeded: logSetupNeededSpy
      }
    })

    frontendProcess = new FrontendProcess({
      theme: null
    })
  })

  afterEach((done) => {
    UserSettings.setInstance()

    delete process.env.USER_PATH
    delete process.env.APP_PATH

    rimraf(userSettingsPath, () => {
      rimraf(appSettingsPath, done)
    })
  })

  describe('FrontendProcess.init()', () => {
    beforeEach(() => {
      frontendProcess.frontendSetup.run = () => Promise.resolve()
      frontendProcess.rapidDevServer = () => {}
      frontendProcess.webpackDevServer = () => {}
    })

    it('should run the frontend setup if nothing is set', () => {
      const runSpy = sinon.spy(frontendProcess.frontendSetup, 'run')

      frontendProcess.init()
      sinon.assert.calledOnce(runSpy)
      runSpy.restore()
    })

    it('it should skip the setup if variables are set', () => {
      const runSpy = sinon.spy(frontendProcess.frontendSetup, 'run')

      frontendProcess.ip = true
      frontendProcess.port = true
      frontendProcess.apiPort = true

      frontendProcess.init()
      sinon.assert.notCalled(runSpy)
      runSpy.restore()
    })
  })

  describe('FrontendProcess.rapidDevServer()', () => {
    beforeEach(() => {
      frontendProcess.frontendSetup.run = () => Promise.resolve()
      frontendProcess.webpackDevServer = () => {}
    })

    it('should not start the rapid dev server if no variables are set', () => {
      const rapidDevServerSpy = sinon.spy(frontendProcess, 'rapidDevServer')

      frontendProcess.init()
      sinon.assert.notCalled(rapidDevServerSpy)
    })

    it('should start the call the rapid dev server if all is set', (done) => {
      const rapidDevServerSpy = sinon.spy(frontendProcess, 'rapidDevServer')

      frontendProcess.ip = true
      frontendProcess.port = true
      frontendProcess.apiPort = true

      frontendProcess.init()
        .then(() => {
          sinon.assert.calledOnce(rapidDevServerSpy)
          sinon.assert.calledOnce(forkSpy)
          done()
        })
        .catch((error) => {
          done(error)
        })
    })

    it('should throw a error if something went wrong', (done) => {
      frontendProcess.ip = true
      frontendProcess.port = true
      frontendProcess.apiPort = true
      forkFail = true

      frontendProcess.init()
        .then(() => {
          forkFail = false
          done('Did not throw!')
        })
        .catch((error) => {
          forkFail = false
          assert.equal(error.message, forkFailError)
          done()
        })
    })
  })

  describe('FrontendProcess.webpackDevServer()', () => {
    beforeEach(() => {
      frontendProcess.frontendSetup.run = () => Promise.resolve()
      frontendProcess.rapidDevServer = () => {}
    })

    it('should not start the webpack dev server if no variables are set', () => {
      const rapidDevServerSpy = sinon.spy(frontendProcess, 'webpackDevServer')

      frontendProcess.init()
      sinon.assert.notCalled(rapidDevServerSpy)
    })

    it('should start the call the webpack dev server if all is set', (done) => {
      const rapidDevServerSpy = sinon.spy(frontendProcess, 'webpackDevServer')

      frontendProcess.ip = true
      frontendProcess.port = true
      frontendProcess.apiPort = true

      frontendProcess.init()
        .then(() => {
          sinon.assert.calledOnce(rapidDevServerSpy)
          sinon.assert.calledOnce(forkSpy)
          done()
        })
        .catch((error) => {
          done(error)
        })
    })

    it('should throw a error if something went wrong', (done) => {
      frontendProcess.ip = true
      frontendProcess.port = true
      frontendProcess.apiPort = true
      forkFail = true

      frontendProcess.init()
        .then(() => {
          forkFail = false
          done('Did not throw!')
        })
        .catch((error) => {
          forkFail = false
          assert.equal(error.message, forkFailError)
          done()
        })
    })
  })
})
