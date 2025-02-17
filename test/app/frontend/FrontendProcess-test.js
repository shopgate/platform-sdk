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
const spawnFailError = 'Spawn failed!'
const findWebpackConfigError = 'No Webpack config found!'
let forkFail = false
let spawnFail = false
let existsSyncFail = false
let forkSpy
let spawnSpy
let existsSyncSpy
const logSetupNeededSpy = sinon.spy()

describe('FrontendProcess', () => {
  let tempDir
  let userSettingsPath
  let appSettingsPath

  let frontendProcess

  let frontendSettings = null
  let appSettings = {
    getApplicationFolder: () => { },
    getFrontendSettings: () => frontendSettings,
    loadAttachedExtensions: () => { }
  }

  before(async () => {
    tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    userSettingsPath = path.join(tempDir, 'user')
    appSettingsPath = path.join(tempDir, 'app')
  })

  beforeEach(() => {
    process.env.USER_DIR = userSettingsPath
    process.env.APP_PATH = appSettingsPath

    appSettings.getId = () => { }
    frontendSettings = {}
    const FrontendProcess = proxyquire('../../../lib/app/frontend/FrontendProcess', {
      fs: {
        existsSync: existsSyncSpy = sinon.spy(() => {
          return !existsSyncFail
        })
      },
      child_process: {
        fork: forkSpy = sinon.spy(() => {
          if (forkFail) throw new Error(forkFailError)
        }),
        spawn: spawnSpy = sinon.spy(() => {
          if (spawnFail) throw new Error(spawnFailError)
        })
      },
      '../../i18n': () => {
        return () => findWebpackConfigError
      },
      './LogHelper': {
        logSetupNeeded: logSetupNeededSpy
      }
    })

    const frontendSetup = {
      run: () => Promise.resolve()
    }

    frontendProcess = new FrontendProcess({
      theme: 'theme-gmd'
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
      frontendProcess.rapidDevServer = async () => { }
      frontendProcess.webpackDevServer = async () => { }
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

    it('should start the rapid dev server if all is set', () => {
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
      frontendProcess.rapidDevServer = async () => { }
    })

    it('should start the webpack dev server if all is set', () => {
      frontendSettings.getIpAddress = () => Promise.resolve('1.1.1.1')
      frontendSettings.getPort = () => Promise.resolve(12345)
      frontendSettings.getApiPort = () => Promise.resolve(23456)
      frontendSettings.loadSettings = () => Promise.resolve({})
      appSettings.getApplicationFolder = () => 'folder'

      return frontendProcess.run()
        .then(() => {
          sinon.assert.calledOnce(existsSyncSpy)
          sinon.assert.calledOnce(spawnSpy)
          sinon.assert.calledWith(spawnSpy, 'npx', ['webpack-dev-server'])
        })
        .catch((err) => assert.ifError(err))
    })

    it('should throw a error if spawning the webpack-dev-server went wrong', async () => {
      frontendSettings.getIpAddress = () => Promise.resolve('1.1.1.1')
      frontendSettings.getPort = () => Promise.resolve(12345)
      frontendSettings.getApiPort = () => Promise.resolve(23456)
      frontendSettings.loadSettings = () => Promise.resolve({})
      spawnFail = true

      try {
        await frontendProcess.run()
        assert.fail('Did not throw')
      } catch (err) {
        assert.equal(err.message, spawnFailError)
      }

      spawnFail = false
    })

    it('should throw a error if no webpack config was found', async () => {
      frontendSettings.getIpAddress = () => Promise.resolve('1.1.1.1')
      frontendSettings.getPort = () => Promise.resolve(12345)
      frontendSettings.getApiPort = () => Promise.resolve(23456)
      frontendSettings.loadSettings = () => Promise.resolve({})
      existsSyncFail = true

      try {
        await frontendProcess.run()
        assert.fail('Did not throw')
      } catch (err) {
        assert.equal(err.message, findWebpackConfigError)
      }

      existsSyncFail = false
    })
  })
})
