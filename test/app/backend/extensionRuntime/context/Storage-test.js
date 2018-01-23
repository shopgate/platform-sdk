const assert = require('assert')
const path = require('path')
const proxyquire = require('proxyquire')

const fsEx = {}

const Storage = proxyquire('../../../../../lib/app/backend/extensionRuntime/context/Storage', {
  'fs-extra': fsEx
})

describe('Storage', () => {
  let log
  const appSettings = {settingsFolder: 'fooBar'}

  beforeEach(() => {
    log = {log: true, debug: () => {}}
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
    it('should cb undefined if path was not set', done => {
      fsEx.readJSON = (file, options, cb) => { cb(new Error('file not found')) }

      const storage = new Storage(appSettings, log)
      storage.get('foo/bar/foobar', (err, value) => {
        assert.ifError(err)
        assert.equal(value, undefined)
        done()
      })
    })

    it('should cb value if path was set', done => {
      const value = {foo: 'bar'}
      const path = 'foo/bar/foobar'
      fsEx.readJSON = (file, options, cb) => {
        cb(null, {
          'foo/bar/foobar': value
        })
      }

      const storage = new Storage(appSettings, log)
      storage.get(path, (err, v) => {
        assert.ifError(err)
        assert.equal(v, value)
        done()
      })
    })
  })

  describe('set', () => {
    it('should set value and call save', done => {
      const value = {foo: 'bar'}
      const path = 'foo/bar/foobar'
      let called = 0

      fsEx.readJSON = (file, options, cb) => cb(null, {})
      fsEx.writeJSON = (file, content, options, cb) => {
        assert.equal(content[path], value)
        called++
        cb(null)
      }

      const storage = new Storage(appSettings, log)
      storage.set(path, value, err => {
        assert.ifError(err)
        assert.equal(called, 1)
        done()
      })
    })
  })

  describe('del', () => {
    it('should delete value and call save', done => {
      const value = {foo: 'bar'}
      const path = 'foo/bar/foobar'
      let called = 0

      fsEx.readJSON = (file, options, cb) => cb(null, {'foo/bar/foobar': value})
      fsEx.writeJSON = (file, content, options, cb) => {
        assert.equal(content[path], undefined)
        called++
        cb(null)
      }

      const storage = new Storage(appSettings, log)
      storage.del(path, err => {
        assert.ifError(err)
        assert.equal(called, 1)
        done()
      })
    })
  })
})
