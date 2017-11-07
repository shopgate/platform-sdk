const assert = require('assert')
const path = require('path')
const mkdirp = require('mkdirp')
const AppSettings = require('../../../lib/app/AppSettings')
const UserSettings = require('../../../lib/user/UserSettings')
const BackendProcess = require('../../../lib/app/backend/BackendProcess')

const appPath = path.join('test', 'appsettings')

/**
 * TODO:
 * + full selectApplication test - even though it will be removed?
 * + first test does not disconnect..
 */
describe('BackendProcess', () => {
  let backendProccess
  let mockServer
  let testFolder

  before(() => {
    process.env.SGCLOUD_DC_WS_ADDRESS = 'http://localhost:12223'
    testFolder = path.join('test', 'appsettings')
    process.env.APP_PATH = testFolder
  })

  after(() => {
    delete process.env.SGCLOUD_DC_WS_ADDRESS
  })

  beforeEach(() => {
    mockServer = require('socket.io').listen(12223)
    backendProccess = new BackendProcess()
    const appSettings = new AppSettings()
    mkdirp.sync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    appSettings.setId('shop_10006').setAttachedExtensions({}).save().init()
    AppSettings.setInstance(appSettings)
    UserSettings.getInstance().getSession().token = {}
  })

  afterEach((done) => {
    /*backendProccess.disconnect((err) => {
      if (err) return done(err)
      mockServer.close(() => {
        console.log("Mockserver closed")
        done()
      })
    })*/
    backendProccess.disconnect((err) => { assert.ifError(err) })
    setTimeout(() => mockServer.close(done), 5) // Client has to disconnect first
  })

  describe('select application', () => {
    it('should select an application', (done) => {
      mockServer.on('connection', (sock) => {
        sock.on('selectApplication', (data, cb) => {
          assert.deepEqual(data, {applicationId: 'shop_10006'})
          cb()
        })
      })
      backendProccess.connect(done)
    })

    it('should fail if socket sends error', (done) => {
      mockServer.on('connection', (sock) => {
        sock.on('selectApplication', (data, cb) => {
          const err = new Error('Forbidden')
          err.code = 403
          cb(err)
        })
      })

      backendProccess.connect((err) => {
        assert.ok(err)
        assert.equal(err.code, 403)
        done()
      })
    })

    it('should fail if socket is not open', (done) => {
      backendProccess.socket = null
      backendProccess.selectApplication('shop_10006', err => {
        assert.ok(err)
        assert.equal(err.message, 'Connection not established')
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
      backendProccess.connect(() => {
        backendProccess.extensionWatcher.onAttach('ext1')
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
      backendProccess.connect(() => {
        backendProccess.extensionWatcher.onDetach('ext1')
      })
    })
  })
})
