const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const AttachedExtensionsWatcher = require('../../lib/app/AttachedExtensionsWatcher')
const UserSettings = require('../../lib/user/UserSettings')
const utils = require('../../lib/utils/utils')
const appPath = path.join('build', 'appsettings')
const mockFs = require('mock-fs')
describe('AttachedExtensionsWatcher', () => {
  let attachedExtensionsWatcher
  let appSettingsMock

  beforeEach(async () => {
    mockFs()
    await new UserSettings().setToken({})
    await fsEx.emptyDir(path.join(appPath, '.sgcloud'))
  })

  afterEach(async () => {
    delete process.env.APP_PATH

    await attachedExtensionsWatcher.stop()
    await fsEx.remove(appPath)
    mockFs.restore()
  })

  const getWatcher = (chokidar, attachedExtensions) => {
    appSettingsMock = {
      attachedExtensionsFile: path.join(appPath, '.sgcloud', 'attachedExtensions.json'),
      getApplicationFolder: utils.getApplicationFolder,
      loadAttachedExtensions: async () => (attachedExtensions)
    }
    attachedExtensionsWatcher = new AttachedExtensionsWatcher(appSettingsMock)
    fsEx.ensureDirSync(path.dirname(attachedExtensionsWatcher.configPath))
    attachedExtensionsWatcher.chokidar = chokidar
    return attachedExtensionsWatcher
  }

  it('should emit "attach" and "detach" events', (done) => {
    let attachedExtensionsFileContents = '{"attachedExtensions":{"@shopgate/auth0Login":{"path":"auth0-login","trusted":true}}}'
    let expectedExtensionToBeAttached = { path: 'auth0-login', trusted: true, id: '@shopgate/auth0Login' }

    let callbacks = []
    const chokidar = {
      closed: false,
      watch: (path, options) => {
        assert.equal(path, attachedExtensionsWatcher.configPath)
        return attachedExtensionsWatcher.chokidar
      },
      on: (event, cb) => {
        if (event === 'ready') cb()
        if (!callbacks[event]) callbacks[event] = []
        callbacks[event].push(cb)
        return attachedExtensionsWatcher.chokidar
      },
      close: () => {
        setTimeout(() => {
          attachedExtensionsWatcher.chokidar.closed = true
        }, 30)
      }
    }

    let attached = false
    let detached = false
    const watcher = getWatcher(chokidar, { 'someId': { 'path': 'something preattached', tusted: false } })
    watcher.start().then(() => {
      watcher.emit = (event, extension) => {
        if (event === 'attach') {
          attached = true
          assert.deepEqual(extension, expectedExtensionToBeAttached)
        }

        if (event === 'detach') {
          detached = true
        }

        if (attached && detached) {
          done()
        }
      }
      setTimeout(() => {
        fsEx.writeFileSync(path.join(attachedExtensionsWatcher.configPath), attachedExtensionsFileContents)
        callbacks['all'][0]('all', path.join(attachedExtensionsWatcher.configPath))
      })
    })
  })
})
