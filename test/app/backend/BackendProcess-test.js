const EventEmitter = require('events')
const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const AppSettings = require('../../../lib/app/AppSettings')
const UserSettings = require('../../../lib/user/UserSettings')
const portfinder = require('portfinder')
const async = require('neo-async')

const proxyquire = require('proxyquire')

class SocketIOMock extends EventEmitter {
  connect () { this.emit('connect') }
  disconnect () { this.disconnected = true }
  removeListener () {}
}

class WatcherMock extends EventEmitter {
  start (cb) { cb() }
  stop () {}
}

describe('BackendProcess', () => {
  let backendProcess
  let stepExecutor
  let userTestFolder
  let appTestFolder
  let userSettings
  let appSettings

  const socketIOMock = new SocketIOMock()

  const BackendProcess = proxyquire('../../../lib/app/backend/BackendProcess', {
    'socket.io-client': () => socketIOMock
  })

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
      const logger = { info: () => {}, error: () => {}, debug: () => {} }
      backendProcess = new BackendProcess(userSettings, appSettings, logger)
      backendProcess.executor = stepExecutor
      backendProcess.attachedExtensionsWatcher = new WatcherMock()
      done()
    })
  })

  afterEach((done) => {
    delete process.env.SGCLOUD_DC_ADDRESS
    delete process.env.APP_PATH
    delete process.env.USER_PATH

    socketIOMock.removeAllListeners()

    async.parallel([
      (cb) => fsEx.remove(appTestFolder, cb),
      (cb) => fsEx.remove(userTestFolder, cb),
      (cb) => backendProcess.disconnect(cb)
    ], done)
  })

  describe('select application', () => {
    it('should select an application', (done) => {
      socketIOMock.on('selectApplication', (data, cb) => {
        assert.deepEqual(data, {applicationId: 'shop_10006'})
        cb()
      })

      socketIOMock.on('resetPipelines', (data, cb) => cb())
      socketIOMock.on('reloadPipelines', (data, cb) => cb())

      backendProcess.connect(done)
    })

    it('should fail if socket sends error', (done) => {
      socketIOMock.on('selectApplication', (data, cb) => {
        const err = new Error('Forbidden')
        err.code = 403
        cb(err)
      })
      backendProcess.connect((err) => {
        assert.ok(err)
        assert.equal(err.code, 403)
        done()
      })
    })

    it('should fail if socket sends error (reset)', (done) => {
      socketIOMock.on('selectApplication', (data, cb) => {
        assert.deepEqual(data, {applicationId: 'shop_10006'})
        cb()
      })

      socketIOMock.on('resetPipelines', (data, cb) => cb(new Error('error')))
      backendProcess.connect((err) => {
        assert.ok(err)
        assert.equal(err.message, 'error')
        done()
      })
    })

    it('should fail if socket sends error (reload)', (done) => {
      socketIOMock.on('selectApplication', (data, cb) => {
        assert.deepEqual(data, {applicationId: 'shop_10006'})
        cb()
      })

      socketIOMock.on('resetPipelines', (data, cb) => cb())
      socketIOMock.on('reloadPipelines', (data, cb) => cb(new Error('error')))

      backendProcess.connect((err) => {
        assert.ok(err)
        assert.equal(err.message, 'error')
        done()
      })
    })

    it('should forward on extensions attach', (done) => {
      socketIOMock.on('selectApplication', (data, cb) => {
        assert.deepEqual(data, {applicationId: 'shop_10006'})
        cb()
      })

      socketIOMock.on('resetPipelines', (data, cb) => cb())
      socketIOMock.on('reloadPipelines', (data, cb) => cb())

      socketIOMock.on('registerExtension', (data, cb) => {
        assert.deepEqual(data, {extensionId: 'testExt', trusted: false})
        cb()
        done()
      })

      backendProcess.connect(() => {
        backendProcess.attachedExtensionsWatcher.emit('attach', {id: 'testExt', trusted: false})
      })
    })

    it('should forward on extensions detach', (done) => {
      socketIOMock.on('selectApplication', (data, cb) => {
        assert.deepEqual(data, {applicationId: 'shop_10006'})
        cb()
      })

      socketIOMock.on('resetPipelines', (data, cb) => cb())
      socketIOMock.on('reloadPipelines', (data, cb) => cb())

      socketIOMock.on('deregisterExtension', (data, cb) => {
        assert.deepEqual(data, {extensionId: 'testExt', trusted: false})
        cb()
        done()
      })

      backendProcess.connect(() => {
        backendProcess.attachedExtensionsWatcher.emit('detach', {id: 'testExt', trusted: false})
      })
    })
  })

  describe('update token', () => {
    const token = { foo: 'bar' }

    it('should update the token', () => {
      backendProcess.updateToken(token)
      assert.deepEqual(userSettings.getToken(), token)
    })
  })
})
