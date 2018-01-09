const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const ExtensionConfigWatcher = require('../../lib/app/ExtensionConfigWatcher')
const utils = require('../../lib/utils/utils')

const appPath = path.join('test', 'appsettings')

describe('ExtensionConfigWatcher', () => {
  let extensionConfigWatcher

  beforeEach((done) => {
    process.env.APP_PATH = appPath
    const appSettingsMock = {getApplicationFolder: utils.getApplicationFolder}
    extensionConfigWatcher = new ExtensionConfigWatcher(appSettingsMock)
    fsEx.emptyDir(path.join(appPath, 'extensions'), done)
  })

  afterEach((done) => {
    delete process.env.APP_PATH

    extensionConfigWatcher.stop(() => {
      fsEx.remove(appPath, done)
    })
  })

  it('should emit changed config', (done) => {
    let writtenConfig = {
      someAttribtue: '2'
    }

    extensionConfigWatcher.on('configChange', (config) => {
      assert.deepEqual(config.file, writtenConfig)
      done()
    })

    extensionConfigWatcher.start(() => {
      fsEx.ensureDir(path.join(extensionConfigWatcher.watchFolder, 'testExt'), (err) => {
        assert.ifError(err)
        fsEx.writeJson(path.join(extensionConfigWatcher.watchFolder, 'testExt', 'extension-config.json'), writtenConfig, () => {})
      })
    })
  })

  it('should stop watching on command', (done) => {
    extensionConfigWatcher.start()
    extensionConfigWatcher.stop(done)
  })
})
