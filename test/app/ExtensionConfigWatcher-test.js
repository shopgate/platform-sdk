const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const ExtensionConfigWatcher = require('../../lib/app/ExtensionConfigWatcher')
const mockFs = require('mock-fs')
const appPath = path.join('build', 'appsettings')

describe('ExtensionConfigWatcher', () => {
  let extensionConfigWatcher

  beforeEach((done) => {
    mockFs()
    process.env.APP_PATH = appPath
    const appSettingsMock = {getApplicationFolder: () => appPath}
    extensionConfigWatcher = new ExtensionConfigWatcher(appSettingsMock)
    fsEx.emptyDir(path.join(appPath, 'extensions'), done)
  })

  afterEach(async () => {
    delete process.env.APP_PATH

    await extensionConfigWatcher.stop()
    await fsEx.remove(appPath)
    mockFs.restore()
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
      closed: false,
      watch: (givenPath, options) => {
        assert.equal(givenPath, path.join('build/appsettings/extensions/*', 'extension-config.json'))
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
    extensionConfigWatcher.start().then(() => {
      fsEx.ensureDirSync(path.join(extensionConfigWatcher.watchFolder, 'testExt'))
      fsEx.writeJsonSync(extensionConfigPath, writtenConfig)

      setTimeout(() => {
        callbacks['all'][0]('add', extensionConfigPath)
      }, 100)
    })
  })
})
