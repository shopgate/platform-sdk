/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const { promisify } = require('util')

const forkFailError = 'Fork failed!'
let forkFail = false
let forkSpy
const logSetupNeededSpy = sinon.spy()

describe('FrontendProcess', () => {
  let tempDir
  let userSettingsPath
  let appSettingsPath

  let frontendProcess

  let frontendSettings = null
  let appSettings = {
    getApplicationFolder: () => {},
    getFrontendSettings: () => frontendSettings,
    loadAttachedExtensions: () => {}
  }

  before(async () => {
    tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    userSettingsPath = path.join(tempDir, 'user')
    appSettingsPath = path.join(tempDir, 'app')
  })

  beforeEach(() => {
    process.env.USER_PATH = userSettingsPath
    process.env.APP_PATH = appSettingsPath

    appSettings.getId = () => {}
    frontendSettings = {}
    const FrontendProcess = proxyquire('../../../lib/app/frontend/FrontendProcess', {
      child_process: {
        fork: forkSpy = sinon.spy(() => {
          if (forkFail) throw new Error(forkFailError)
        })
      },
      './LogHelper': {
        logSetupNeeded: logSetupNeededSpy
      }
    })

    const frontendSetup = {
      run: () => Promise.resolve()
    }

    frontendProcess = new FrontendProcess({
      theme: null
    }, frontendSetup, appSettings)
  })

  afterEach(async () => {
    await fsEx.emptyDir(tempDir)
  })

  after(async () => {
    await fsEx.remove(tempDir)
  })

  describe('run()', () => {
    beforeEach(() => {
      frontendProcess.rapidDevServer = async () => {}
      frontendProcess.webpackDevServer = async () => {}
    })

    it('should run the frontend setup if nothing is set', () => {
      const runSpy = sinon.spy(frontendProcess.frontendSetup, 'run')

      frontendSettings.getIpAddress = () => Promise.resolve(null)
      frontendSettings.getPort = () => Promise.resolve(null)
      frontendSettings.getApiPort = () => Promise.resolve(null)

      return frontendProcess.run()
        .then(() => {
          sinon.assert.calledOnce(runSpy)
          runSpy.restore()
        })
        .catch(err => assert.ifError(err))
    })

    it('it should skip the setup if variables are set', () => {
      const runSpy = sinon.spy(frontendProcess.frontendSetup, 'run')

      frontendSettings.getIpAddress = () => Promise.resolve('1.1.1.1')
      frontendSettings.getPort = () => Promise.resolve(12345)
      frontendSettings.getApiPort = () => Promise.resolve(23456)

      return frontendProcess.run()
        .then(() => {
          sinon.assert.notCalled(runSpy)
          runSpy.restore()
        })
        .catch(err => assert.ifError(err))
    })
  })

  describe('rapidDevServer()', () => {
    beforeEach(() => {
      frontendProcess.frontendSetup.run = () => Promise.resolve()
      frontendProcess.webpackDevServer = () => Promise.resolve()
    })

    it('should start the rapid dev server if no variables are set', () => {
      const runSpy = sinon.spy(frontendProcess.frontendSetup, 'run')
      const rapidDevServerSpy = sinon.spy(frontendProcess, 'rapidDevServer')

      frontendSettings.getIpAddress = () => Promise.resolve(null)
      frontendSettings.getPort = () => Promise.resolve(null)
      frontendSettings.getApiPort = () => Promise.resolve(null)
      frontendSettings.loadSettings = () => Promise.resolve({})

      return frontendProcess.run()
        .then(() => {
          sinon.assert.calledOnce(runSpy)
          sinon.assert.calledOnce(rapidDevServerSpy)
          runSpy.restore()
        })
        .catch(err => assert.ifError(err))
    })

    it('should start the call the rapid dev server if all is set', () => {
      const rapidDevServerSpy = sinon.spy(frontendProcess, 'rapidDevServer')

      frontendSettings.getIpAddress = () => Promise.resolve('1.1.1.1')
      frontendSettings.getPort = () => Promise.resolve(12345)
      frontendSettings.getApiPort = () => Promise.resolve(23456)
      frontendSettings.loadSettings = () => Promise.resolve({})

      return frontendProcess.run()
        .then(() => {
          sinon.assert.calledOnce(rapidDevServerSpy)
          sinon.assert.calledOnce(forkSpy)
        })
        .catch((error) => assert.ifError(error))
    })

    it('should throw a error if something went wrong', () => {
      frontendSettings.getIpAddress = () => Promise.resolve('1.1.1.1')
      frontendSettings.getPort = () => Promise.resolve(12345)
      frontendSettings.getApiPort = () => Promise.resolve(23456)
      frontendSettings.loadSettings = () => Promise.resolve({})
      forkFail = true

      return frontendProcess.run()
        .then(() => {
          forkFail = false
          assert.fail('Did not throw')
        })
        .catch((error) => {
          forkFail = false
          assert.equal(error.message, forkFailError)
        })
    })
  })

  describe('webpackDevServer()', () => {
    beforeEach(() => {
      frontendProcess.frontendSetup.run = () => Promise.resolve()
      frontendProcess.rapidDevServer = async () => {}
    })

    it('should start the webpack dev server if no variables are set', () => {
      const runSpy = sinon.spy(frontendProcess.frontendSetup, 'run')
      const webpackDevServerSpy = sinon.spy(frontendProcess, 'webpackDevServer')

      frontendSettings.getIpAddress = () => Promise.resolve(null)
      frontendSettings.getPort = () => Promise.resolve(null)
      frontendSettings.getApiPort = () => Promise.resolve(null)
      frontendSettings.loadSettings = () => Promise.resolve({})
      appSettings.getApplicationFolder = () => 'folder'

      return frontendProcess.run()
        .then(() => {
          sinon.assert.calledOnce(runSpy)
          sinon.assert.calledOnce(webpackDevServerSpy)
          runSpy.restore()
        })
        .catch((err) => assert.ifError(err))
    })

    it('should start the call the webpack dev server if all is set', () => {
      const webpackDevServerSpy = sinon.spy(frontendProcess, 'webpackDevServer')

      frontendSettings.getIpAddress = () => Promise.resolve('1.1.1.1')
      frontendSettings.getPort = () => Promise.resolve(12345)
      frontendSettings.getApiPort = () => Promise.resolve(23456)
      frontendSettings.loadSettings = () => Promise.resolve({})
      appSettings.getApplicationFolder = () => 'folder'

      return frontendProcess.run()
        .then(() => {
          sinon.assert.calledOnce(webpackDevServerSpy)
          sinon.assert.calledOnce(forkSpy)
        })
        .catch((err) => assert.ifError(err))
    })

    it('should throw a error if something went wrong', async () => {
      frontendSettings.getIpAddress = () => Promise.resolve('1.1.1.1')
      frontendSettings.getPort = () => Promise.resolve(12345)
      frontendSettings.getApiPort = () => Promise.resolve(23456)
      frontendSettings.loadSettings = () => Promise.resolve({})
      forkFail = true

      try {
        await frontendProcess.run()
        assert.fail('Did not throw')
      } catch (err) {
        assert.equal(err.message, forkFailError)
      }

      forkFail = false
    })
  })
})
