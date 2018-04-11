const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const mockFs = require('mock-fs')
const MapStorage = require('../../../../../lib/app/backend/extensionRuntime/context/MapStorage')

describe('MapStorage', () => {
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

  describe('set', () => {
    it('should set value and call save', () => {
      const value = { foo: 'bar' }
      const key = 'foo/bar/foobar'

      const storage = new MapStorage(storageFilePath, log)

      return new Promise((resolve, reject) => {
        storage.set(key, value, err => {
          try {
            assert.ifError(err)
            const actual = fsEx.readJsonSync(storageFilePath)
            assert.deepEqual(actual[key], value)
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })

    it('should cb with an error if value is not an object', (done) => {
      const storage = new MapStorage(storageFilePath, log)

      storage.set('foo', 'bar', err => {
        assert.ok(err)
        assert.equal(err.message, 'Cannot save non-object as a map: "bar".')
        done()
      })
    })

    it('should cb with an error if writing fails', () => {
      const storage = new MapStorage('non-existent-folder/storage.json', log)

      return new Promise(resolve => {
        storage.set('key', 'value', err => {
          assert.ok(err)
          resolve()
        })
      })
    })

    it('should set value and return promise', async () => {
      const value = { foo: 'bar' }
      const key = 'foo/bar/foobar'
      const storage = new MapStorage(storageFilePath, log)
      await storage.set(key, value)
      const actual = fsEx.readJsonSync(storageFilePath)
      assert.deepEqual(actual[key], value)
    })

    it('should throw an error if value is not an object', async () => {
      const storage = new MapStorage(storageFilePath, log)

      try {
        await storage.set('foo', 'bar')
        assert.fail('Expected error to be thrown.')
      } catch (err) {
        assert.equal(err.message, 'Cannot save non-object as a map: "bar".')
      }
    })

    it('should throw an error if writing fails', async () => {
      const storage = new MapStorage('non-existent-folder/storage.json', log)

      try {
        await storage.set('key', 'value')
        assert.fail('Expected error to be thrown.')
      } catch (err) {
        assert.ok(err)
      }
    })
  })

  describe('del', () => {
    it('should delete value and call save', () => {
      const value = { foo: 'bar' }
      const content = {
        'foo/bar/foobar': value
      }
      fsEx.writeJsonSync(storageFilePath, content)

      const confirmWrite = fsEx.readJsonSync(storageFilePath)
      assert.deepEqual(confirmWrite, content)

      const storage = new MapStorage(storageFilePath, log)

      return new Promise((resolve, reject) => {
        storage.del('foo/bar/foobar', err => {
          try {
            assert.ifError(err)
            const actual = fsEx.readJsonSync(storageFilePath)
            assert.deepEqual(actual, {})
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })

    it('should cb with an error if writing fails', () => {
      const storage = new MapStorage('non-existent-folder/storage.json', log)

      return new Promise(resolve => {
        storage.del('key', err => {
          assert.ok(err)
          resolve()
        })
      })
    })

    it('should delete value and return a promise', async () => {
      const value = { foo: 'bar' }
      const content = {
        'foo/bar/foobar': value
      }
      fsEx.writeJsonSync(storageFilePath, content)
      const confirmWrite = fsEx.readJsonSync(storageFilePath)
      assert.deepEqual(confirmWrite, content)
      const storage = new MapStorage(storageFilePath, log)
      await storage.del('foo/bar/foobar')
      const actual = fsEx.readJsonSync(storageFilePath)
      assert.deepEqual(actual, {})
    })

    it('should throw an error if writing fails', async () => {
      const storage = new MapStorage('non-existent-folder/storage.json', log)

      try {
        await storage.del('key')
        assert.fail('Expected error to be thrown.')
      } catch (err) {
        assert.ok(err)
      }
    })
  })
})
