const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const ExtensionConfigWatcher = require('../lib/ExtensionConfigWatcher')

const appPath = path.join('test', 'appsettings')

describe('ExtensionConfigWatcher', () => {
  let extensionWatcher

  beforeEach(() => {
    process.env.APP_PATH = appPath

    extensionWatcher = new ExtensionConfigWatcher({useFsEvents: false})
    mkdirp.sync(path.join(appPath, 'extensions'))
  })

  afterEach((done) => {
    extensionWatcher.close(() => {
      delete process.env.APP_PATH
      rimraf(appPath, done)
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

    extensionWatcher.start()
    extensionWatcher.watcher.interval = 1

    setTimeout(() => {
      fsEx.ensureDirSync(path.join(extensionWatcher.extensionFolder, 'testExt'))
      fsEx.writeJsonSync(path.join(extensionWatcher.extensionFolder, 'testExt', 'extension-config.json'), writtenConfig)
    }, 50)
  })

  it('should stop watching on command', (done) => {
    extensionWatcher.start()
    extensionWatcher.close(done)
  })
})
