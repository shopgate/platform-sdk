const assert = require('assert')
const path = require('path')
const mkdirp = require('mkdirp')
const fsEx = require('fs-extra')
const AppSettings = require('../../../lib/app/AppSettings')
const UserSettings = require('../../../lib/user/UserSettings')
const BackendProcess = require('../../../lib/app/backend/BackendProcess')
const rimraf = require('rimraf')
const appPath = path.join('test', 'appsettings')
const portfinder = require('portfinder')

describe('BackendProcess', () => {
  let backendProcess
  let stepExecutor
  let mockServer
  let appTestFolder

  beforeEach((done) => {
    portfinder.getPort((err, port) => {
      process.env.SGCLOUD_DC_WS_ADDRESS = `http://localhost:${port}`
      appTestFolder = path.join('test', 'appsettings')
      process.env.APP_PATH = appTestFolder
      assert.ifError(err)
      mockServer = require('socket.io').listen(port)
      stepExecutor = {start: () => {}, stop: (cb) => cb(), watch: () => {}}
      backendProcess = new BackendProcess({useFsEvents: false})
      backendProcess.executor = stepExecutor
      const appSettings = new AppSettings()
      mkdirp.sync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
      appSettings.setId('shop_10006').setAttachedExtensions({}).save().init()
      AppSettings.setInstance(appSettings)
      UserSettings.getInstance().getSession().token = {}
      done()
    })
  })

  afterEach((done) => {
    backendProcess.extensionWatcher.close()

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
})
