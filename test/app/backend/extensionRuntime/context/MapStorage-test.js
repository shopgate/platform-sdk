const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const mockFs = require('mock-fs')
const MapStorage = require('../../../../../lib/app/backend/extensionRuntime/context/MapStorage')

describe('MapStorage', () => {
  let settingsFolderPath
  let storageFilePath
  let storageFilePathNonExisting
  let log

  beforeEach(() => {
    mockFs()
    settingsFolderPath = path.join('path', 'to')
    storageFilePath = path.join(settingsFolderPath, 'map_storage.json')
    storageFilePathNonExisting = path.join('non-existent-folder', 'storage.json')
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

  describe('get cb', () => {
    it('should cb {} if storage not available/empty', () => {
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

    it('should cb value', () => {
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
  })

  describe('get Promise', () => {
    it('should return Promise<{}> if storage not available/empty', async () => {
      const storage = new MapStorage(storageFilePath, log)
      const value = await storage.get('baz')
      assert.deepEqual(value, {})
    })

    it('should return Promise<value>', async () => {
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

  describe('set cb', () => {
    it('should set the map, save the storage file and cb', () => {
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

    it('should cb with an error if value is not an object', () => {
      const storage = new MapStorage(storageFilePath, log)

      return new Promise((resolve, reject) => {
        storage.set('foo', 'bar', err => {
          try {
            assert.ok(err)
            assert.equal(err.message, 'Cannot save non-object as a map: "bar".')
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })

    it('should cb with an error if saving fails', () => {
      const storage = new MapStorage(storageFilePathNonExisting, log)

      return new Promise((resolve, reject) => {
        storage.set('key', {key: 'value'}, err => {
          try {
            assert.ok(err)
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })
  })

  describe('set Promise', () => {
    it('should set the map, save the storage file and resolve', async () => {
      const value = { foo: 'bar' }
      const key = 'foo/bar/foobar'
      const storage = new MapStorage(storageFilePath, log)
      await storage.set(key, value)
      const actual = fsEx.readJsonSync(storageFilePath)
      assert.deepEqual(actual[key], value)
    })

    it('should throw an error if value is not an object', async () => {
      const storage = new MapStorage(storageFilePath, log)

      let expectedErrorThrown = false
      try {
        await storage.set('foo', 'bar')
      } catch (err) {
        assert.equal(err.message, 'Cannot save non-object as a map: "bar".')
        expectedErrorThrown = true
      }

      if (!expectedErrorThrown) {
        assert.fail('Expected error to be thrown.')
      }
    })

    it('should throw an error if saving fails', async () => {
      const storage = new MapStorage(storageFilePathNonExisting, log)

      let expectedErrorThrown = false
      try {
        await storage.set('key', 'value')
      } catch (err) {
        assert.equal(err.message, 'Cannot save non-object as a map: "value".')
        expectedErrorThrown = true
      }

      if (!expectedErrorThrown) {
        assert.fail('Expected error to be thrown.')
      }
    })
  })

  describe('del cb', () => {
    it('should delete the map, save the storage file and cb', () => {
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

    it('should cb with an error if saving fails', () => {
      const storage = new MapStorage(storageFilePathNonExisting, log)

      return new Promise((resolve, reject) => {
        storage.del('key', err => {
          try {
            assert.ok(err)
          } catch (err) {
            reject(err)
          }
          resolve()
        })
      })
    })
  })

  describe('del Promise', () => {
    it('should delete value, save the storage file and resolve', async () => {
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

    it('should throw an error if saving fails', async () => {
      const storage = new MapStorage(storageFilePathNonExisting, log)

      let expectedErrorThrown = false
      try {
        await storage.del('key')
      } catch (err) {
        expectedErrorThrown = true
      }

      if (!expectedErrorThrown) {
        assert.fail('Expected an error to be thrown.')
      }
    })
  })

  describe('getItem cb', () => {
    it('should cb undefined if map is not available', () => {
      const storage = new MapStorage(storageFilePath, log)

      return new Promise((resolve, reject) => {
        storage.getItem('foo', 'bar', (err, actual) => {
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

    it('should cb value', () => {
      const storage = new MapStorage(storageFilePath, log)
      const map = { bar: 'baz' }
      const content = {
        'foo': map
      }
      fsEx.writeJsonSync(storageFilePath, content)

      return new Promise((resolve, reject) => {
        storage.getItem('foo', 'bar', (err, actual) => {
          try {
            assert.ifError(err)
            assert.equal(actual, 'baz')
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })
  })

  describe('getItem Promise', () => {
    it('should return Promise<undefined> if map is not available', async () => {
      const storage = new MapStorage(storageFilePath, log)

      assert.equal(await storage.getItem('foo', 'bar'), undefined)
    })

    it('should return Promise<any>', async () => {
      const storage = new MapStorage(storageFilePath, log)
      const map = { bar: 'baz' }
      const content = {
        'foo': map
      }
      fsEx.writeJsonSync(storageFilePath, content)

      assert.equal(await storage.getItem('foo', 'bar'), 'baz')
    })
  })

  describe('setItem cb', () => {
    it('should create non-existing map, add item to it, save the storage file and cb', () => {
      const storage = new MapStorage(storageFilePath, log)
      const expectedContent = { foo: { bar: 'baz' } }

      return new Promise((resolve, reject) => {
        storage.setItem('foo', 'bar', 'baz', err => {
          try {
            assert.ifError(err)
            assert.deepEqual(fsEx.readJsonSync(storageFilePath), expectedContent)
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })

    it('should add item to existing map, save the storage file and cb', () => {
      const storage = new MapStorage(storageFilePath, log)
      const newKey = 'newkey'
      const newValue = 'newvalue'
      const expectedContent = { foo: { bar: 'baz', newkey: 'newvalue' } }

      fsEx.writeJsonSync(storageFilePath, { foo: { bar: 'baz' } })

      return new Promise((resolve, reject) => {
        storage.setItem('foo', newKey, newValue, err => {
          try {
            assert.ifError(err)
            assert.deepEqual(fsEx.readJsonSync(storageFilePath), expectedContent)
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })

    it('should replace existing item in map, save the storage file and cb', () => {
      const storage = new MapStorage(storageFilePath, log)
      const expectedContent = { foo: { bar: 'bazoo' } }

      fsEx.writeJsonSync(storageFilePath, { foo: { bar: 'baz' } })

      return new Promise((resolve, reject) => {
        storage.setItem('foo', 'bar', 'bazoo', err => {
          try {
            assert.ifError(err)
            assert.deepEqual(fsEx.readJsonSync(storageFilePath), expectedContent)
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })

    it('should cb error if saving fails', () => {
      const storage = new MapStorage(storageFilePathNonExisting, log)

      return new Promise((resolve, reject) => {
        storage.setItem('foo', 'bar', 'baz', err => {
          try {
            assert.ok(err)
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })
  })

  describe('setItem Promise', () => {
    it('should create non-existing map, add item to it, save the storage file and resolve', async () => {
      const storage = new MapStorage(storageFilePath, log)
      const expectedContent = { foo: { bar: 'baz' } }

      await storage.setItem('foo', 'bar', 'baz')

      assert.deepEqual(fsEx.readJsonSync(storageFilePath), expectedContent)
    })

    it('should add item to existing map, save the storage file and resolve', async () => {
      const storage = new MapStorage(storageFilePath, log)
      const newKey = 'newkey'
      const newValue = 'newvalue'
      const expectedContent = { foo: { bar: 'baz', newkey: 'newvalue' } }

      fsEx.writeJsonSync(storageFilePath, { foo: { bar: 'baz' } })

      await storage.setItem('foo', newKey, newValue)

      assert.deepEqual(fsEx.readJsonSync(storageFilePath), expectedContent)
    })

    it('should replace existing item in map, save the storage file and resolve', async () => {
      const storage = new MapStorage(storageFilePath, log)
      const expectedContent = { foo: { bar: 'bazoo' } }

      fsEx.writeJsonSync(storageFilePath, { foo: { bar: 'baz' } })

      await storage.setItem('foo', 'bar', 'bazoo')

      assert.deepEqual(fsEx.readJsonSync(storageFilePath), expectedContent)
    })

    it('should throw error if saving fails', async () => {
      const storage = new MapStorage(storageFilePathNonExisting, log)

      let expectedErrorThrown = false
      try {
        await storage.setItem('foo', 'bar', 'baz')
      } catch (err) {
        expectedErrorThrown = true
      }

      if (!expectedErrorThrown) {
        assert.fail('Expected error to be thrown.')
      }
    })
  })

  describe('delItem cb', () => {
    it('should cb if the map that the item should be removed from does not exist', () => {
      const storage = new MapStorage(storageFilePath, log)
      const expectedContent = { foo: { bar: 'baz' } }

      fsEx.writeJsonSync(storageFilePath, expectedContent)

      return new Promise((resolve, reject) => {
        storage.delItem('foodle', 'bar', err => {
          try {
            assert.ifError(err)
            assert.deepEqual(fsEx.readJsonSync(storageFilePath), expectedContent)
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })

    it('should cb if the item to be removed does not exist in the map', () => {
      const storage = new MapStorage(storageFilePath, log)
      const expectedContent = { foo: { bar: 'baz' } }

      fsEx.writeJsonSync(storageFilePath, expectedContent)

      return new Promise((resolve, reject) => {
        storage.delItem('foo', 'barzoo', err => {
          try {
            assert.ifError(err)
            assert.deepEqual(fsEx.readJsonSync(storageFilePath), expectedContent)
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })

    it('should remove item from map, save storage file and cb', () => {
      const storage = new MapStorage(storageFilePath, log)
      const expectedContent = { foo: {} }

      fsEx.writeJsonSync(storageFilePath, { foo: { bar: 'baz' } })

      return new Promise((resolve, reject) => {
        storage.delItem('foo', 'bar', err => {
          try {
            assert.ifError(err)
            assert.deepEqual(fsEx.readJsonSync(storageFilePath), expectedContent)
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })

    it('should cb error if saving fails', () => {
      const storage = new MapStorage(storageFilePath, log)

      fsEx.writeJsonSync(storageFilePath, { foo: { bar: 'baz' } })
      fsEx.chmodSync(storageFilePath, 0o444)

      return new Promise((resolve, reject) => {
        storage.delItem('foo', 'bar', err => {
          try {
            assert.ok(err)
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })
  })

  describe('delItem Promise', () => {
    it('should resolve if the map that the item should be removed from does not exist', async () => {
      const storage = new MapStorage(storageFilePath, log)
      const expectedContent = { foo: { bar: 'baz' } }

      fsEx.writeJsonSync(storageFilePath, expectedContent)

      await storage.delItem('foodle', 'bar')
      assert.deepEqual(fsEx.readJsonSync(storageFilePath), expectedContent)
    })

    it('should resolve if the item to be removed does not exist in the map', async () => {
      const storage = new MapStorage(storageFilePath, log)
      const expectedContent = { foo: { bar: 'baz' } }

      fsEx.writeJsonSync(storageFilePath, expectedContent)

      await storage.delItem('foo', 'barzoo')
      assert.deepEqual(fsEx.readJsonSync(storageFilePath), expectedContent)
    })

    it('should remove item from map, save storage file and resolve', async () => {
      const storage = new MapStorage(storageFilePath, log)
      const expectedContent = { foo: {} }

      fsEx.writeJsonSync(storageFilePath, { foo: { bar: 'baz' } })

      await storage.delItem('foo', 'bar')
      assert.deepEqual(fsEx.readJsonSync(storageFilePath), expectedContent)
    })

    it('should throw error if saving fails', async () => {
      const storage = new MapStorage(storageFilePath, log)

      fsEx.writeJsonSync(storageFilePath, { foo: { bar: 'baz' } })
      fsEx.chmodSync(storageFilePath, 0o444)

      let expectedErrorThrown = false
      try {
        await storage.delItem('foo', 'bar')
      } catch (err) {
        expectedErrorThrown = true
      }

      if (!expectedErrorThrown) {
        assert.fail('Expected error to be thrown.')
      }
    })
  })
})
