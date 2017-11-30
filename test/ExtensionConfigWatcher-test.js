const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const ExtensionConfigWatcher = require('../lib/ExtensionConfigWatcher')

const appPath = path.join('test', 'appsettings')

describe('ExtensionConfigWatcher', () => {
  let extensionWatcher

  beforeEach((done) => {
    process.env.APP_PATH = appPath

    extensionWatcher = new ExtensionConfigWatcher({useFsEvents: false, interval: 1})
    fsEx.emptyDir(path.join(appPath, 'extensions'), done)
  })

  afterEach((done) => {
    delete process.env.APP_PATH

    extensionWatcher.stop(() => {
      fsEx.remove(appPath, done)
    })
  })

  it('should emit changed config', (done) => {
    let writtenConfig = {
      someAttribtue: '2'
    }

    extensionWatcher.on('configChange', (config) => {
      assert.deepEqual(config.file, writtenConfig)
      done()
    })

    extensionWatcher.start(() => {
      fsEx.ensureDir(path.join(extensionWatcher.extensionFolder, 'testExt'), (err) => {
        assert.ifError(err)
        fsEx.writeJson(path.join(extensionWatcher.extensionFolder, 'testExt', 'extension-config.json'), writtenConfig, () => {})
      })
    })
  })

  it('should stop watching on command', (done) => {
    extensionWatcher.start()
    extensionWatcher.stop(done)
  })
})
