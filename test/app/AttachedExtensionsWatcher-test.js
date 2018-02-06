const assert = require('assert')
const sinon = require('sinon')
const path = require('path')
const fsEx = require('fs-extra')
const AttachedExtensionsWatcher = require('../../lib/app/AttachedExtensionsWatcher')
const utils = require('../../lib/utils/utils')

const appPath = path.join('build', 'appsettings')

describe('AttachedExtensionsWatcher', () => {
  let attachedExtensionsWatcher
  let appSettingsMock

  beforeEach(async () => {
    appSettingsMock = {
      attachedExtensionsFile: path.join(appPath, '.sgcloud', 'attachedExtensions.json'),
      getApplicationFolder: utils.getApplicationFolder
    }
    attachedExtensionsWatcher = new AttachedExtensionsWatcher(appSettingsMock)
    await fsEx.emptyDir(path.join(appPath, '.sgcloud'))
  })

  afterEach(async () => {
    delete process.env.APP_PATH

    await attachedExtensionsWatcher.stop()
    await fsEx.remove(appPath)
  })

  it('should emit "attach" event', (done) => {
    let initialAttachedExtensions = {}
    let attachedExtensionsFileContents = '{"attachedExtensions":{"@shopgate/auth0Login":{"path":"auth0-login","trusted":true}}}'
    let expectedExtensionToBeAttached = {path: 'auth0-login', trusted: true, id: '@shopgate/auth0Login'}

    appSettingsMock.loadAttachedExtensions = sinon.stub().resolves(initialAttachedExtensions)

    attachedExtensionsWatcher.on('attach', (extension) => {
      assert.deepEqual(extension, expectedExtensionToBeAttached)
      done()
    })

    attachedExtensionsWatcher.start()
      .then(() => fsEx.ensureDir(path.dirname(attachedExtensionsWatcher.configPath)))
      .then(() => {
        return new Promise((resolve, reject) => {
          // Workaround for race condition ...
          setTimeout(() => {
            fsEx.writeFile(path.join(attachedExtensionsWatcher.configPath), attachedExtensionsFileContents, (err) => {
              if (err) reject(err)
              resolve()
            })
          }, 500)
        })
      })
      .catch((err) => {
        assert.ifError(err)
      })
  })

  it('should emit "detach" event', (done) => {
    let initialAttachedExtensions = {'@shopgate/auth0Login': {path: 'auth0-login', trusted: true}}
    let attachedExtensionsFileContents = '{"attachedExtensions":{}}'
    let expectedExtensionToBeDetached = {path: 'auth0-login', trusted: true, id: '@shopgate/auth0Login'}

    appSettingsMock.loadAttachedExtensions = sinon.stub().resolves(initialAttachedExtensions)

    attachedExtensionsWatcher.on('detach', (extension) => {
      assert.deepEqual(extension, expectedExtensionToBeDetached)
      done()
    })

    attachedExtensionsWatcher.start()
      .then(() => fsEx.ensureDir(path.dirname(attachedExtensionsWatcher.configPath)))
      .then(() => fsEx.writeFile(path.join(attachedExtensionsWatcher.configPath), attachedExtensionsFileContents))
      .catch((err) => {
        assert.ifError(err)
      })
  })
})
