const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const ExtensionConfigWatcher = require('../../lib/app/ExtensionConfigWatcher')
const utils = require('../../lib/utils/utils')

const appPath = path.join('build', 'appsettings')

describe('ExtensionConfigWatcher', () => {
  let extensionConfigWatcher

  beforeEach((done) => {
    process.env.APP_PATH = appPath
    const appSettingsMock = {getApplicationFolder: utils.getApplicationFolder}
    extensionConfigWatcher = new ExtensionConfigWatcher(appSettingsMock)
    fsEx.emptyDir(path.join(appPath, 'extensions'), done)
  })

  afterEach(async () => {
    delete process.env.APP_PATH

    await extensionConfigWatcher.stop()
    await fsEx.remove(appPath)
  })

  it('should emit changed config', (done) => {
    let writtenConfig = {
      someAttribtue: '2'
    }

    extensionConfigWatcher.on('configChange', (config) => {
      assert.deepEqual(config.file, writtenConfig)
      extensionConfigWatcher.stop().then(() => {
        done()
      })
    })

    const extensionFolder = path.join(extensionConfigWatcher.watchFolder, 'testExt')

    extensionConfigWatcher.start()
    .then(() => fsEx.ensureDir(extensionFolder))
    .then(() => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const configPath = path.join(extensionFolder, 'extension-config.json')
          fsEx.writeJson(configPath, writtenConfig, () => {})
          resolve()
        }, 20)
      })
    })
    .catch((err) => {
      assert.ifError(err)
    })
  })

  it('should stop watching', () => {
    return extensionConfigWatcher.start()
      .then(() => extensionConfigWatcher.stop())
      .then(() => assert.ok(extensionConfigWatcher.watcher.closed))
  })
})
