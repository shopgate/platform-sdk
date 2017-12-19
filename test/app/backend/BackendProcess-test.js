const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const AppSettings = require('../../../lib/app/AppSettings')
const UserSettings = require('../../../lib/user/UserSettings')
const BackendProcess = require('../../../lib/app/backend/BackendProcess')
const portfinder = require('portfinder')
const async = require('neo-async')
const logger = require('../../../lib/logger')

describe('BackendProcess', () => {
  let backendProcess
  let stepExecutor
  let mockServer
  let userTestFolder
  let appTestFolder
  let userSettings
  let appSettings

  beforeEach((done) => {
    appTestFolder = path.join('build', 'appsettings')
    process.env.APP_PATH = appTestFolder
    appSettings = new AppSettings().setId('shop_10006')

    userTestFolder = path.join('build', 'usersettings')
    process.env.USER_PATH = userTestFolder
    userSettings = new UserSettings().setToken({})

    stepExecutor = {
      start: (cb) => cb(),
      stop: (cb) => cb(),
      startWatcher: (cb) => cb(),
      stopWatcher: (cb) => cb()
    }

    portfinder.getPort((err, port) => {
      assert.ifError(err)

      process.env.SGCLOUD_DC_ADDRESS = `http://localhost:${port}`
      backendProcess = new BackendProcess(userSettings, appSettings, logger)
      backendProcess.executor = stepExecutor
      mockServer = require('socket.io').listen(port)
      done()
    })
  })

  afterEach((done) => {
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
    const token = { foo: 'bar' }

    it('should update the token', () => {
      backendProcess.updateToken(token)
      assert.deepEqual(userSettings.getToken(), token)
    })
  })
})
