const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const ExtensionConfigWatcher = require('../../lib/app/ExtensionConfigWatcher')

describe('ExtensionConfigWatcher', () => {
  let tempDir
  let appPath
  let extensionConfigWatcher

  before(async () => {
    tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    appPath = path.join(tempDir, 'app')
  })

  beforeEach(async () => {
    await fsEx.emptyDir(tempDir)
    process.env.APP_PATH = appPath
    const appSettingsMock = { getApplicationFolder: () => appPath, settingsFolder: 'build/appsettings' }
    extensionConfigWatcher = new ExtensionConfigWatcher(appSettingsMock)

    await fsEx.emptyDir(path.join(appPath, 'extensions'))
  })

  afterEach(async () => {
    delete process.env.APP_PATH

    await extensionConfigWatcher.stop()
    await fsEx.emptyDir(appPath)
  })

  after(async () => {
    await fsEx.remove(tempDir)
  })

  it('should emit changed config', (done) => {
    let writtenConfig = {
      someAttribtue: '2'
    }
    const callbacks = []

    extensionConfigWatcher.emit = (event, config) => {
      assert.equal(event, 'configChange')
      assert.deepEqual(config.file, writtenConfig)
      extensionConfigWatcher.stop().then(() => {
        done()
      })
    }

    extensionConfigWatcher.chokidar = {
      removeAllListeners: async () => (true),
      closed: false,
      watch: (givenPath, options) => {
        assert.equal(givenPath, path.join(appPath, 'extensions', '*', 'extension-config.json'))
        return extensionConfigWatcher.chokidar
      },
      on: (event, cb) => {
        if (event === 'ready') cb()
        if (!callbacks[event]) callbacks[event] = []
        callbacks[event].push(cb)
        return extensionConfigWatcher.chokidar
      },
      close: () => {
        setTimeout(() => {
          extensionConfigWatcher.chokidar.closed = true
        }, 30)
      }
    }

    const extensionConfigPath = path.join(extensionConfigWatcher.watchFolder, 'testExt', 'extension-config.json')
    extensionConfigWatcher.start('backend').then(() => {
      fsEx.ensureDirSync(path.join(extensionConfigWatcher.watchFolder, 'testExt'))
      fsEx.writeJsonSync(extensionConfigPath, writtenConfig)

      setTimeout(() => {
        callbacks['all'][0]('add', extensionConfigPath)
      }, 100)
    })
  })
})
