const assert = require('assert')
const path = require('path')
const mockFs = require('mock-fs')
const fsEx = require('fs-extra')
const proxyquire = require('proxyquire')

const logger = {
  debug: (message) => { },
  warn: (message) => { },
  info: (message) => { },
  error: (message) => { }
}

let extensionConfigValidated = false
let called = false
const EventHandler = proxyquire('../../lib/utils/EventHandler', {
  '../logger': logger,
  './utils': {
    generateComponentsJson: () => {
      called = true
      return true
    },
    validateExtensionConfig: () => {
      extensionConfigValidated = true
    }
  }
})

describe('EventHandler', () => {
  before(async () => {
    mockFs()
  })
  after(async () => {
    mockFs.restore()
  })
  it('should write config.json and components.json on change', (done) => {
    const config = {
      file: {
        id: 'foo'
      },
      path: 'bar'
    }
    fsEx.ensureDirSync(path.join(config.path, 'extension'))
    fsEx.ensureDirSync(path.join(config.path, 'frontend'))
    const expectedBackendConfig = {
      something: 'something'
    }
    const expectedFrontendConfig = {
      somethingElse: 'somethingElse'
    }
    const settings = {
      getId: async () => (1)
    }
    const dcClient = {
      generateExtensionConfig: async (file, appId) => {
        return {
          backend: expectedBackendConfig,
          frontend: expectedFrontendConfig
        }
      }
    }
    EventHandler.extensionConfigChanged(config, settings, dcClient).then(async () => {
      assert.equal(called, true)
      assert.equal(extensionConfigValidated, true)
      assert.deepEqual(await fsEx.readJson(path.join(config.path, 'extension', 'config.json')), expectedBackendConfig)
      assert.deepEqual(await fsEx.readJson(path.join(config.path, 'frontend', 'config.json')), expectedFrontendConfig)
      done()
    })
  })
})
