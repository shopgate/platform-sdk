const assert = require('assert')
const path = require('path')
const mockFs = require('mock-fs')
const fsEx = require('fs-extra')
const proxyquire = require('proxyquire')

const logger = {
  debug: (message) => { },
  warn: (message) => { },
  info: (message) => { }
}

let called = false
const EventHandler = proxyquire('../../lib/utils/EventHandler', {
  '../logger': logger,
  './utils': {
    generateComponentsJson: () => {
      called = true
      return true
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
      file: 'foo',
      path: 'bar'
    }
    const expectedConfig = {
      something: 'something'
    }
    const settings = {
      getId: async () => (1)
    }
    const dcClient = {
      generateExtensionConfig: async (file, appId) => {
        return {
          backend: expectedConfig
        }
      }
    }
    EventHandler.extensionConfigChanged(config, settings, dcClient).then(async () => {
      assert.equal(called, true)
      assert.deepEqual(await fsEx.readJson(path.join(config.path, 'extension', 'config.json')), expectedConfig)
      done()
    })
  })
})
