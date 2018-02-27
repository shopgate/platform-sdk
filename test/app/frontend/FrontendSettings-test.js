/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
const path = require('path')
const assert = require('assert')
const proxyquire = require('proxyquire')

let fsEx = {}
let logger = {}

const FrontendSettings = proxyquire('../../../lib/app/frontend/FrontendSettings', {
  'fs-extra': fsEx,
  '../../logger': logger
})

const mockFs = require('mock-fs')

describe('FrontendSettings', () => {
  before(done => {
    mockFs()
    done()
  })

  after(done => {
    mockFs.restore()
    done()
  })

  let settingsPath
  let settings

  beforeEach(() => {
    fsEx.readJson = () => Promise.resolve({})
    fsEx.writeJson = () => Promise.resolve()
    fsEx.ensureDir = () => Promise.resolve()

    logger.debug = () => {}

    settingsPath = path.join('build', 'foobar')
    settings = new FrontendSettings(settingsPath)
  })

  it('can be instanciated', () => {
    assert.ok(settings instanceof FrontendSettings)
  })

  describe('loadSettings', () => {
    it('should return valid settings', () => {
      const s = {foo: 'bar'}
      fsEx.readJson = () => Promise.resolve(s)

      return settings.loadSettings()
        .then(result => {
          assert.deepEqual(s, result)
        })
        .catch(err => assert.ifError(err))
    })

    it('should return an empty settings object', () => {
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
      })
      .catch(err => assert.ifError(err))
    })
  })

  describe('_saveSettings', () => {
    it('should save the settings', () => {
      const s = {foo: 'bar'}

      let ensureCalled = 0
      fsEx.ensureDir = (folder) => {
        ensureCalled++
        assert.equal(folder, settingsPath)
        return Promise.resolve()
      }

      let writeJsonCalled = 0
      fsEx.writeJson = (file, settingsContent, options) => {
        writeJsonCalled++
        assert.equal(path.join(settingsPath, 'frontend.json'), file)
        assert.deepEqual(settingsContent, s)
        assert.deepEqual(options, {spaces: 2})
        return Promise.resolve()
      }

      return settings._saveSettings(s)
        .then(() => {
          assert.equal(ensureCalled, 1)
          assert.equal(writeJsonCalled, 1)
        })
        .catch(err => assert.ifError(err))
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

    beforeEach(() => {
      fsEx.readJson = () => Promise.resolve(orgSettings)
    })

    describe('getIpAddress', () => {
      it('should get the ip address', () => {
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
    beforeEach(() => { fsEx.readJson = () => Promise.resolve({}) })

    describe('setIpAddress', () => {
      it('should set the ip address', () => {
        const ip = '1.1.1.1'

        let called = 0
        fsEx.writeJson = (file, s) => {
          assert.equal(file, path.join('build', 'foobar', 'frontend.json'))
          assert.deepEqual({ip}, s)
          called++
        }

        return settings.setIpAddress(ip)
          .then(() => assert.equal(called, 1))
          .catch(err => assert.ifError(err))
      })
    })

    describe('setPort', () => {
      it('should set the port', () => {
        const port = 12345

        let called = 0
        fsEx.writeJson = (file, s) => {
          assert.deepEqual({port}, s)
          called++
        }

        return settings.setPort(port)
          .then(() => assert.equal(called, 1))
          .catch(err => assert.ifError(err))
      })
    })

    describe('setApiPort', () => {
      it('should set the api port', () => {
        const apiPort = 23456

        let called = 0
        fsEx.writeJson = (file, s) => {
          assert.equal(file, path.join('build', 'foobar', 'frontend.json'))
          assert.deepEqual({apiPort}, s)
          called++
        }

        return settings.setApiPort(apiPort)
          .then(() => assert.equal(called, 1))
          .catch(err => assert.ifError(err))
      })
    })

    describe('setHmrPort', () => {
      it('should set the hmr port', () => {
        const hmrPort = 34567

        let called = 0
        fsEx.writeJson = (file, s) => {
          assert.equal(file, path.join('build', 'foobar', 'frontend.json'))
          assert.deepEqual({hmrPort}, s)
          called++
        }

        return settings.setHmrPort(hmrPort)
          .then(() => assert.equal(called, 1))
          .catch(err => assert.ifError(err))
      })
    })

    describe('setRemotePort', () => {
      it('should set the remote port', () => {
        const remotePort = 45678

        let called = 0
        fsEx.writeJson = (file, s) => {
          assert.equal(file, path.join('build', 'foobar', 'frontend.json'))
          assert.deepEqual({remotePort}, s)
          called++
        }

        return settings.setRemotePort(remotePort)
          .then(() => assert.equal(called, 1))
          .catch(err => assert.ifError(err))
      })
    })

    describe('setAccessToken', () => {
      it('should set the access token', () => {
        const accessToken = 'abcabcacb'

        let called = 0
        fsEx.writeJson = (file, s) => {
          assert.equal(file, path.join('build', 'foobar', 'frontend.json'))
          assert.deepEqual({accessToken}, s)
          called++
        }

        return settings.setAccessToken(accessToken)
          .then(() => assert.equal(called, 1))
          .catch(err => assert.ifError(err))
      })
    })

    describe('setSourceMapsType', () => {
      it('should set the source map type', () => {
        const sourceMapsType = 'type'

        let called = 0
        fsEx.writeJson = (file, s) => {
          assert.equal(file, path.join('build', 'foobar', 'frontend.json'))
          assert.deepEqual({sourceMapsType}, s)
          called++
        }

        return settings.setSourceMapsType(sourceMapsType)
          .then(() => assert.equal(called, 1))
          .catch(err => assert.ifError(err))
      })
    })
  })
})
