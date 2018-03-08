const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const mockFs = require('mock-fs')
const Storage = require('../../../../../lib/app/backend/extensionRuntime/context/Storage')

describe.only('Storage', () => {
  let log
  const appSettings = { settingsFolder: 'fooBar' }

  beforeEach(() => {
    mockFs()
    fsEx.ensureDirSync(appSettings.settingsFolder)
    log = { log: true, debug: () => { } }
  })

  afterEach(() => {
    mockFs.restore()
  })
  describe('constructor', () => {
    it('should construct with default path', () => {
      delete process.env.STORAGE_PATH

      const storage = new Storage(appSettings, log)
      assert.equal(storage.path, path.join(appSettings.settingsFolder, 'storage.json'))
      assert.equal(storage.log, log)
    })
  })

  describe('get', () => {
    it('should cb undefined if path was not set', () => {
      const storage = new Storage(appSettings, log)

      return new Promise((resolve, reject) => {
        storage.get('baz', (err, actual) => {
          try {
            assert.ifError(err)
            assert.equal(actual, undefined)
          } catch (err) {
            reject(err)
          }
          resolve()
        })
      })
    })

    it('should cb value if path was set', () => {
      const expected = { foo: 'bar' }
      const key = 'foo/bar/bar'
      fsEx.ensureDirSync(path.join(appSettings.settingsFolder))
      const content = {}
      content[key] = expected
      fsEx.writeJsonSync(path.join(appSettings.settingsFolder, 'storage.json'), content)

      const storage = new Storage(appSettings, log)

      return new Promise((resolve, reject) => {
        storage.get(key, (err, actual) => {
          try {
            assert.ifError(err)
            assert.deepEqual(actual, expected)
          } catch (err) {
            reject(err)
          }
          resolve()
        })
      })
    })
  })

  describe('set', () => {
    it('should set value and call save', () => {
      const value = { foo: 'bar' }
      const key = 'foo/bar/foobar'

      const storage = new Storage(appSettings, log)

      return new Promise((resolve, reject) => {
        storage.set(key, value, err => {
          try {
            assert.ifError(err)
            const actual = fsEx.readJsonSync(path.join(appSettings.settingsFolder, 'storage.json'))
            assert.deepEqual(actual[key], value)
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })
  })

  describe('del', () => {
    it('should delete value and call save', () => {
      const value = { foo: 'bar' }
      const content = {
        'foo/bar/foobar': value
      }
      fsEx.writeJsonSync(path.join(appSettings.settingsFolder, 'storage.json'), content)

      const confirmWrite = fsEx.readJsonSync(path.join(appSettings.settingsFolder, 'storage.json'))
      assert.deepEqual(confirmWrite, content)

      const storage = new Storage(appSettings, log)

      return new Promise((resolve, reject) => {
        storage.del('foo/bar/foobar', err => {
          try {
            assert.ifError(err)
            const actual = fsEx.readJsonSync(path.join(appSettings.settingsFolder, 'storage.json'))
            assert.deepEqual(actual, {})
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })
  })
})
