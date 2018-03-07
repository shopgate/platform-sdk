const assert = require('assert')
const path = require('path')
const proxyquire = require('proxyquire')

const fsEx = {}

const Storage = proxyquire('../../../../../lib/app/backend/extensionRuntime/context/Storage', {
  'fs-extra': fsEx
})

describe('Storage', () => {
  let log
  const appSettings = { settingsFolder: 'fooBar' }

  beforeEach(() => {
    log = { log: true, debug: () => {} }
    fsEx.readJSON = (file, options, cb) => cb(new Error('not implemented'))
    fsEx.writeJSON = (file, content, options, cb) => cb(new Error('not implemented'))
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
      fsEx.readJSON = () => { throw new Error('file not found') }

      const storage = new Storage(appSettings, log)

      return new Promise((resolve, reject) => {
        storage.get('foo/bar/foobar', (err, actual) => {
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
      const path = 'foo/bar/foobar'
      fsEx.readJSON = () => {
        return {
          'foo/bar/foobar': expected
        }
      }

      const storage = new Storage(appSettings, log)

      return new Promise((resolve, reject) => {
        storage.get(path, (err, actual) => {
          try {
            assert.ifError(err)
            assert.equal(actual, expected)
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
      const path = 'foo/bar/foobar'
      let called = 0

      fsEx.readJSON = () => { return {} }
      fsEx.writeJSON = (file, content) => {
        assert.equal(content[path], value)
        called++
      }

      const storage = new Storage(appSettings, log)

      return new Promise((resolve, reject) => {
        storage.set(path, value, err => {
          try {
            assert.ifError(err)
            assert.equal(called, 1)
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
      const path = 'foo/bar/foobar'
      let called = 0

      fsEx.readJSON = () => { return { 'foo/bar/foobar': value } }
      fsEx.writeJSON = (file, content) => {
        assert.equal(content[path], undefined)
        called++
      }

      const storage = new Storage(appSettings, log)

      return new Promise((resolve, reject) => {
        storage.del(path, err => {
          try {
            assert.ifError(err)
            assert.equal(called, 1)
          } catch (err) {
            reject(err)
          }

          resolve()
        })
      })
    })
  })
})
