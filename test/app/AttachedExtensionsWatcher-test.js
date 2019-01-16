const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const AttachedExtensionsWatcher = require('../../lib/app/AttachedExtensionsWatcher')
const config = require('../../lib/config')
const UserSettings = require('../../lib/user/UserSettings')
const utils = require('../../lib/utils/utils')

describe('AttachedExtensionsWatcher', () => {
  let tempDir
  let userDir
  let appPath
  let attachedExtensionsWatcher
  let appSettingsMock

  before(async () => {
    tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    userDir = path.join(tempDir, 'user')
    appPath = path.join(tempDir, 'app')
    config.load({ userDirectory: userDir })
  })

  beforeEach(async () => {
    await fsEx.emptyDir(tempDir)
    await fsEx.emptyDir(path.join(appPath, '.sgcloud'))
    await new UserSettings().setToken({})
  })

  afterEach(async () => {
    delete process.env.APP_PATH

    await attachedExtensionsWatcher.stop()
    await fsEx.emptyDir(appPath)
  })

  after(async () => {
    await fsEx.remove(tempDir)
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
