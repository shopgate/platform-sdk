const assert = require('assert')
const path = require('path')
const mkdirp = require('mkdirp')
const fsEx = require('fs-extra')
const AppSettings = require('../../../lib/app/AppSettings')
const UserSettings = require('../../../lib/user/UserSettings')
const BackendProcess = require('../../../lib/app/backend/BackendProcess')
const rimraf = require('rimraf')
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
    mkdirp.sync(path.join(appTestFolder, AppSettings.SETTINGS_FOLDER))
    const appSettings = new AppSettings()
    appSettings.setId('shop_10006').setAttachedExtensions({}).save().init()
    AppSettings.setInstance(appSettings)

    userTestFolder = path.join('build', 'usersettings')
    process.env.USER_PATH = userTestFolder
    UserSettings.getInstance().getSession().token = {}

    stepExecutor = {start: (cb) => cb(), stop: (cb) => cb(), watch: () => {}}

    portfinder.getPort((err, port) => {
      assert.ifError(err)

      process.env.SGCLOUD_DC_ADDRESS = `http://localhost:${port}`
      backendProcess = new BackendProcess({useFsEvents: false})
      backendProcess.executor = stepExecutor
      mockServer = require('socket.io').listen(port)
      done()
    })
  })

  afterEach((done) => {
    UserSettings.setInstance()
    AppSettings.setInstance()
    backendProcess.extensionWatcher.close()
    delete process.env.SGCLOUD_DC_ADDRESS
    delete process.env.APP_PATH
    delete process.env.USER_PATH

    async.parallel([
      (cb) => rimraf(appTestFolder, cb),
      (cb) => rimraf(userTestFolder, cb),
      (cb) => backendProcess.disconnect((err) => {
        if (err) return cb(err)
        mockServer.close(cb)
      })
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
          assert.deepEqual(data, {extensionId: 'testExt'})
          cb()
          done()
        })
      })
      backendProcess.connect(() => {
        fsEx.writeJSONSync(backendProcess.extensionWatcher.configPath, {
          'attachedExtensions': {
            'testExt': {
              'id': 'testExt'
            }
          }
        })
      })
    })

    it('should forward on extensions detach', (done) => {
      mockServer.on('connection', (sock) => {
        sock.on('selectApplication', (data, cb) => {
          assert.deepEqual(data, {applicationId: 'shop_10006'})
          cb()
        })

        sock.on('deregisterExtension', (data, cb) => {
          assert.deepEqual(data, {extensionId: 'testExt'})
          cb()
          done()
        })
      })
      backendProcess.connect(() => {
        backendProcess.extensionWatcher.watcher.interval = 1

        fsEx.writeJSONSync(backendProcess.extensionWatcher.configPath, {
          'attachedExtensions': {
            'testExt': {
              'id': 'testExt'
            }
          }
        })
        setTimeout(() => {
          fsEx.writeJSONSync(backendProcess.extensionWatcher.configPath, {
            'attachedExtensions': {}
          })
        }, 50) // Because of Filewatcher-interval
      })
    })
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
