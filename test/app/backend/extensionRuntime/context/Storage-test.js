const Storage = require('../../../../../lib/app/backend/extensionRuntime/context/Storage')
const AppSettings = require('../../../../../lib/app/AppSettings')
const assert = require('assert')
const rimraf = require('rimraf')
const path = require('path')
const fsExtra = require('fs-extra')

describe('Storage', () => {
  let storagePath
  let storage
  beforeEach(() => {
    storagePath = path.join('test', 'storage.json')
    process.env.STORAGE_PATH = storagePath
    storage = new Storage()
  })

  afterEach(done => {
    delete process.env.STORAGE_PATH
    rimraf(storagePath, done)
  })

  describe('constructor', () => {
    it('should construct with default path', () => {
      delete process.env.STORAGE_PATH
      const log = {log: true}
      storage = new Storage(log)
      assert.equal(storage.path, path.join(AppSettings.SETTINGS_FOLDER, 'storage.json'))
      assert.equal(storage.saveQueued, undefined)
      assert.equal(storage.saving, undefined)
      assert.equal(storage.log, log)
    })

    it('should construct empty', () => {
      assert.equal(storage.path, storagePath)
      assert.deepEqual(storage.data, {})
      assert.equal(storage.saveQueued, undefined)
      assert.equal(storage.saving, undefined)
      assert.equal(storage.log, undefined)
    })

    it('should construct with data', () => {
      const data = {foo: 'bar', bar: 'foo'}
      const log = {log: true}
      fsExtra.writeJsonSync(storagePath, data)
      storage = new Storage(log)
      assert.equal(storage.path, storagePath)
      assert.deepEqual(storage.data, data)
      assert.equal(storage.saveQueued, undefined)
      assert.equal(storage.saving, undefined)
      assert.equal(storage.log, log)
    })
  })

  describe('get', () => {
    it('should cb undefined if path was not set', done => {
      storage.get('foo/bar/foobar', (err, value) => {
        assert.ifError(err)
        assert.equal(value, undefined)
        done()
      })
    })

    it('should cb value if path was set set', done => {
      const value = {foo: 'bar'}
      const path = 'foo/bar/foobar'
      storage.data[path] = value

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
      let doneCount = 0
      function isDone () {
        if (doneCount++ === 1) return done()
      }

      storage.save = isDone

      storage.set(path, value, err => {
        assert.ifError(err)
        assert.equal(storage.data[path], value)
        isDone()
      })
    })
  })

  describe('del', () => {
    it('should delete value and call save', done => {
      const path = 'foo/bar/foobar'
      storage.data[path] = {foo: 'bar'}
      let doneCount = 0
      function isDone () {
        if (doneCount++ === 1) return done()
      }

      storage.save = isDone

      storage.del(path, err => {
        assert.ifError(err)
        assert.equal(storage.data[path], undefined)
        isDone()
      })
    })
  })

  describe('save', () => {
    it('should save and call saveCb', done => {
      storage.data.foo = 'bar'
      storage.data.bar = 'foo'

      storage.saveCb = err => {
        assert.ifError(err)
        assert.equal(storage.saveQueued, undefined)
        assert.equal(storage.saving, true)

        fsExtra.readJson(storagePath, (err, data) => {
          assert.ifError(err)
          assert.deepEqual(data, storage.data)
          done()
        })
      }
      storage.save()
    })

    it('should set saveQueued to true if already saving', done => {
      storage.saveCb = err => {
        assert.ifError(err)
        assert.equal(storage.saveQueued, undefined)
        assert.equal(storage.saving, true)
        storage.save()
        assert.equal(storage.saveQueued, true)
        assert.equal(storage.saving, true)
        done()
      }
      storage.save()
    })

    it('should reset saving', () => {
      storage.saving = true
      storage.saveCb()
      assert.equal(storage.saving, false)
    })

    it('should reset saving and call save again if saveQueued', done => {
      storage.saving = true
      storage.saveQueued = true
      storage.save = () => {
        assert.equal(storage.saving, false)
        assert.equal(storage.saveQueued, false)
        done()
      }
      storage.saveCb()
    })

    it('should log errors', done => {
      const error = new Error()
      storage = new Storage({error: (err) => {
        assert.equal(err, error)
        done()
      }})
      storage.saveCb(error)
    })
  })
})
