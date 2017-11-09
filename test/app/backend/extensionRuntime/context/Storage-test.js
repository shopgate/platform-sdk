const Storage = require('../../../../../lib/app/backend/extensionRuntime/context/Storage')
const AppSettings = require('../../../../../lib/app/AppSettings')
const assert = require('assert')
const rimraf = require('rimraf')
const path = require('path')
const fsExtra = require('fs-extra')

describe('Storage', () => {
  let storagePath
  beforeEach(() => {
    storagePath = path.join('test', 'storage.json')
    process.env.STORAGE_PATH = storagePath
  })

  afterEach(done => {
    delete process.env.STORAGE_PATH
    rimraf(storagePath, done)
  })

  describe('constructor', () => {
    it('should construct with default path', () => {
      delete process.env.STORAGE_PATH
      const storage = new Storage()
      assert.equal(storage.path, path.join(AppSettings.SETTINGS_FOLDER, 'storage.json'))
    })

    it('should construct empty', () => {
      const storage = new Storage()
      assert.equal(storage.path, storagePath)
      assert.deepEqual(storage.data, {})
    })

    it('should construct with data', () => {
      const data = {foo: 'bar', bar: 'foo'}
      fsExtra.writeJsonSync(storagePath, data)
      const storage = new Storage()
      assert.equal(storage.path, storagePath)
      assert.deepEqual(storage.data, data)
    })
  })
})
