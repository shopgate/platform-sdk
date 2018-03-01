/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
const path = require('path')
const assert = require('assert')
const proxyquire = require('proxyquire')
const mockFs = require('mock-fs')
const fsEx = require('fs-extra')
let logger = {}

const FrontendSettings = proxyquire('../../../lib/app/frontend/FrontendSettings', {
  '../../logger': logger
})

describe('FrontendSettings', () => {
  let settingsPath
  /** @type {FrontendSettings} */
  let settings

  beforeEach(done => {
    logger.debug = () => {}
    mockFs()
    settingsPath = path.join('build', 'foobar')
    settings = new FrontendSettings(settingsPath)
    done()
  })

  afterEach(done => {
    mockFs.restore()
    done()
  })

  describe('loadSettings', () => {
    it('should return valid settings', async () => {
      const s = {foo: 'bar'}
      await fsEx.ensureDir(settingsPath)
      await fsEx.writeJson(settings.frontendSettingsFile, s)
      const result = await settings.loadSettings()
      assert.deepEqual(s, result)
    })

    it('should return an empty settings object', () => {
      const binding = fsEx.readJson
      fsEx.readJson = () => Promise.reject(new Error('error'))

      let called = 0
      logger.debug = (message) => {
        assert.equal(message, 'error')
        called++
      }

      return settings.loadSettings()
      .then(result => {
        assert.deepEqual({}, result)
        assert.equal(called, 1)
        fsEx.readJson = binding
      })
      .catch(err => {
        assert.ifError(err)
        fsEx.readJson = binding
      })
    })
  })

  describe('_saveSettings', () => {
    it('should save the settings', async () => {
      const s = {foo: 'bar'}
      await settings._saveSettings(s)
      const settingsSaved = await fsEx.readJson(settings.frontendSettingsFile)
      return assert.deepEqual(s, settingsSaved)
    })
  })

  describe('getter functions', () => {
    const orgSettings = {
      ip: '1.1.1.1',
      port: 12345,
      apiPort: 23456,
      hmrPort: 34567,
      remotePort: 45678,
      accessToken: 'abcabcacb',
      sourceMapsType: 'type'
    }

    beforeEach(async() => {
      mockFs()
      await fsEx.ensureDir(settingsPath)
      await fsEx.writeJson(settings.frontendSettingsFile, orgSettings)
    })

    afterEach(() => {
      mockFs.restore()
    })

    describe('getIpAddress', () => {
      it('should get the ip address', async () => {
        return settings.getIpAddress()
          .then(ip => assert.equal(ip, orgSettings.ip))
          .catch((err) => assert.ifError(err))
      })
    })

    describe('getPort', () => {
      it('should get the port', () => {
        return settings.getPort()
        .then(port => assert.equal(port, orgSettings.port))
        .catch((err) => assert.ifError(err))
      })
    })

    describe('getApiPort', () => {
      it('should get the api port', () => {
        return settings.getApiPort()
        .then(apiPort => assert.equal(apiPort, orgSettings.apiPort))
        .catch((err) => assert.ifError(err))
      })
    })

    describe('getHmrPort', () => {
      it('should get the hmr port', () => {
        return settings.getHmrPort()
        .then(hmrPort => assert.equal(hmrPort, orgSettings.hmrPort))
        .catch((err) => assert.ifError(err))
      })
    })

    describe('getRemotePort', () => {
      it('should get the remote port', () => {
        return settings.getRemotePort()
        .then(remotePort => assert.equal(remotePort, orgSettings.remotePort))
        .catch((err) => assert.ifError(err))
      })
    })

    describe('getAccessToken', () => {
      it('should get the access token', () => {
        return settings.getAccessToken()
        .then(accessToken => assert.equal(accessToken, orgSettings.accessToken))
        .catch((err) => assert.ifError(err))
      })
    })

    describe('getSourceMapsType', () => {
      it('should get the source maps type', () => {
        return settings.getSourceMapsType()
        .then(sourceMapsType => assert.equal(sourceMapsType, orgSettings.sourceMapsType))
        .catch((err) => assert.ifError(err))
      })
    })
  })

  describe('setter functions', () => {
    async function checkField (key, value) {
      const read = await fsEx.readJSON(settings.frontendSettingsFile)
      return assert.equal(read[key], value, `set ${key} did not match`)
    }

    describe('setIpAddress', () => {
      it('should set the ip address', async () => {
        const ip = '1.1.1.1'
        await settings.setIpAddress(ip)
        await checkField('ip', ip)
      })
    })

    describe('setPort', () => {
      it('should set the port', async() => {
        const port = 12345
        await settings.setPort(port)
        await checkField('port', port)
      })
    })

    describe('setApiPort', () => {
      it('should set the api port', async() => {
        const port = 12345
        await settings.setApiPort(port)
        await checkField('apiPort', port)
      })
    })

    describe('setHmrPort', () => {
      it('should set the hmr port', async() => {
        const hmrPort = 34567
        await settings.setHmrPort(hmrPort)
        await checkField('hmrPort', hmrPort)
      })
    })

    describe('setRemotePort', () => {
      it('should set the remote port', async () => {
        const remotePort = 45678
        await settings.setRemotePort(remotePort)
        await checkField('remotePort', remotePort)
      })
    })

    describe('setAccessToken', () => {
      it('should set the access token', async () => {
        const accessToken = 'abcabcacb'
        await settings.setAccessToken(accessToken)
        await checkField('accessToken', accessToken)
      })
    })

    describe('setSourceMapsType', () => {
      it('should set the source map type', async() => {
        const sourceMapsType = 'type'
        await settings.setSourceMapsType(sourceMapsType)
        await checkField('sourceMapsType', sourceMapsType)
      })
    })
  })
})
