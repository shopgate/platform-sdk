const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const AppSettings = require('../../../lib/app/AppSettings')
const UserSettings = require('../../../lib/user/UserSettings')
const BackendProcess = require('../../../lib/app/backend/BackendProcess')
const portfinder = require('portfinder')
const async = require('neo-async')

describe('BackendProcess', () => {
  let backendProcess
  let stepExecutor
  let mockServer
  let userTestFolder
  let appTestFolder

  beforeEach((done) => {
    appTestFolder = path.join('build', 'appsettings')
    process.env.APP_PATH = appTestFolder
    fsEx.emptyDirSync(path.join(appTestFolder, AppSettings.SETTINGS_FOLDER))
    const appSettings = new AppSettings()
    appSettings.setId('shop_10006').setAttachedExtensions({}).save().init()
    AppSettings.setInstance(appSettings)

    userTestFolder = path.join('build', 'usersettings')
    process.env.USER_PATH = userTestFolder
    UserSettings.getInstance().getSession().token = {}

    stepExecutor = {
      start: (cb) => cb(),
      stop: (cb) => cb(),
      startWatcher: (cb) => cb(),
      stopWatcher: (cb) => cb()
    }

    portfinder.getPort((err, port) => {
      assert.ifError(err)

      process.env.SGCLOUD_DC_ADDRESS = `http://localhost:${port}`
      backendProcess = new BackendProcess({useFsEvents: false, ignoreInitial: true})
      backendProcess.executor = stepExecutor
      mockServer = require('socket.io').listen(port)
      done()
    })
  })

  afterEach((done) => {
    UserSettings.setInstance()
    AppSettings.setInstance()
    delete process.env.SGCLOUD_DC_ADDRESS
    delete process.env.APP_PATH
    delete process.env.USER_PATH

    async.parallel([
      (cb) => backendProcess.attachedExtensionsWatcher.stop(cb),
      (cb) => fsEx.remove(appTestFolder, cb),
      (cb) => fsEx.remove(userTestFolder, cb),
      (cb) => mockServer.close(cb),
      (cb) => backendProcess.disconnect(cb)
    ], done)
  })

  describe('select application', () => {
    it('should select an application', (done) => {
      mockServer.on('connection', (sock) => {
        sock.on('selectApplication', (data, cb) => {
          assert.deepEqual(data, {applicationId: 'shop_10006'})
          cb()
        })
      })
      backendProcess.connect(done)
    })

    it('should fail if socket sends error', (done) => {
      mockServer.on('connection', (sock) => {
        sock.on('selectApplication', (data, cb) => {
          const err = new Error('Forbidden')
          err.code = 403
          cb(err)
        })
      })

      backendProcess.connect((err) => {
        assert.ok(err)
        assert.equal(err.code, 403)
        done()
      })
    })

    it('should forward on extensions attach', (done) => {
      mockServer.on('connection', (sock) => {
        sock.on('selectApplication', (data, cb) => {
          assert.deepEqual(data, {applicationId: 'shop_10006'})
          cb()
        })

        sock.on('registerExtension', (data, cb) => {
          assert.deepEqual(data, {extensionId: 'testExt', trusted: false})
          cb()
          done()
        })
      })
      backendProcess.connect(() => {
        fsEx.writeJSON(
          backendProcess.attachedExtensionsWatcher.configPath,
          {attachedExtensions: {testExt: {id: 'testExt', trusted: false}}},
          () => {}
        )
      })
    }).timeout(10000)

    it('should forward on extensions detach', (done) => {
      mockServer.on('connection', (sock) => {
        sock.on('selectApplication', (data, cb) => {
          assert.deepEqual(data, {applicationId: 'shop_10006'})
          cb()
        })

        sock.on('deregisterExtension', (data, cb) => {
          assert.deepEqual(data, {extensionId: 'testExt', trusted: false})
          cb()
          done()
        })
      })

      backendProcess.connect(() => {
        fsEx.writeJSON(
          backendProcess.attachedExtensionsWatcher.configPath,
          {attachedExtensions: {testExt: {id: 'testExt', trusted: false}}},
          () => {
            setTimeout(() => {
              fsEx.writeJSON(backendProcess.attachedExtensionsWatcher.configPath,
                {attachedExtensions: {}},
                () => {}
              )
            }, 2000)
          }
        )
      })
    }).timeout(10000)
  })

  describe('update token', () => {
    let oldUserSettingsInstance
    const token = { foo: 'bar' }

    before((done) => {
      oldUserSettingsInstance = UserSettings.getInstance()
      const newUserSettingsInstance = {
        save: () => {},
        getSession: () => { return { setToken: (t) => assert.deepEqual(t, token) } },
        getInstance: function () { return this }
      }

      UserSettings.setInstance(newUserSettingsInstance)
      done()
    })

    after((done) => {
      UserSettings.setInstance(oldUserSettingsInstance)
      done()
    })

    it('should update the token', (done) => {
      backendProcess.updateToken(token)
      done()
    })
  })
})
