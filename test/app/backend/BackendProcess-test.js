const assert = require('assert')
const path = require('path')
const mkdirp = require('mkdirp')
const AppSettings = require('../../../lib/app/AppSettings')
const UserSettings = require('../../../lib/user/UserSettings')
const BackendProcess = require('../../../lib/app/backend/BackendProcess')
const rimraf = require('rimraf')
const appPath = path.join('test', 'appsettings')

describe('BackendProcess', () => {
  let backendProcess
  let mockServer
  let appTestFolder

  beforeEach(() => {
    process.env.SGCLOUD_DC_WS_ADDRESS = 'http://localhost:12223'
    appTestFolder = path.join('test', 'appsettings')
    process.env.APP_PATH = appTestFolder
    mockServer = require('socket.io').listen(12223)
    backendProcess = new BackendProcess()
    const appSettings = new AppSettings()
    mkdirp.sync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    appSettings.setId('shop_10006').setAttachedExtensions({}).save().init()
    AppSettings.setInstance(appSettings)
    UserSettings.getInstance().getSession().token = {}
  })

  afterEach((done) => {
    backendProcess.extensionWatcher.close((err) => {
      if (err) return done(err)
      backendProcess.disconnect((err) => {
        if (err) return done(err)
        mockServer.close((err) => {
          if (err) return done(err)
          delete process.env.SGCLOUD_DC_WS_ADDRESS
          delete process.env.APP_PATH
          delete process.env.USER_PATH
          rimraf(appTestFolder, done)
        })
      })
    })
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
          assert.equal(data, 'ext1')
          cb()
          done()
        })
      })
      backendProcess.connect(() => {
        backendProcess.extensionWatcher.eventEmitter.emit('attach', 'ext1')
      })
    })

    it('should forward on extensions detach', (done) => {
      mockServer.on('connection', (sock) => {
        sock.on('selectApplication', (data, cb) => {
          assert.deepEqual(data, {applicationId: 'shop_10006'})
          cb()
        })

        sock.on('deregisterExtension', (data, cb) => {
          assert.equal(data, 'ext1')
          cb()
          done()
        })
      })
      backendProcess.connect(() => {
        backendProcess.extensionWatcher.eventEmitter.emit('detach', 'ext1')
      })
    })
  })
})
