const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const mockFs = require('mock-fs')
const MapStorage = require('../../../../../lib/app/backend/extensionRuntime/context/MapStorage')

describe('Storage', () => {
  let settingsFolderPath
  let storageFilePath
  let log

  beforeEach(() => {
    mockFs()
    settingsFolderPath = path.join('path', 'to')
    storageFilePath = path.join(settingsFolderPath, 'map_storage.json')
    log = { log: true, debug: () => { } }
    fsEx.ensureDirSync(settingsFolderPath)
  })

  afterEach(() => {
    mockFs.restore()
  })
  describe('constructor', () => {
    it('should construct', () => {
      const storage = new MapStorage(storageFilePath, log)
      assert.equal(storage.path, storageFilePath)
      assert.equal(storage.log, log)
    })
  })

  describe('get', () => {
    it('should cb {} if path was not set', () => {
      const storage = new MapStorage(storageFilePath, log)

      return new Promise((resolve, reject) => {
        storage.get('baz', (err, actual) => {
          try {
            assert.ifError(err)
            assert.deepEqual(actual, {})
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
      const content = {}
      content[key] = expected
      fsEx.writeJsonSync(storageFilePath, content)

      const storage = new MapStorage(storageFilePath, log)

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

    it('should return Promise<{}> if path was not set', async () => {
      const storage = new MapStorage(storageFilePath, log)
      const value = await storage.get('baz')
      assert.deepEqual(value, {})
    })

    it('should return Promise<value> if path was set', async () => {
      const expected = { foo: 'bar' }
      const key = 'foo/bar/bar'
      const content = {}
      content[key] = expected
      fsEx.writeJsonSync(storageFilePath, content)

      const storage = new MapStorage(storageFilePath, log)
      const value = await storage.get(key)

      assert.deepEqual(value, expected)
    })
  })
})
