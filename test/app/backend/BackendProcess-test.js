const EventEmitter = require('events')
const assert = require('assert')
const sinon = require('sinon')
const path = require('path')
const fsEx = require('fs-extra')
const AppSettings = require('../../../lib/app/AppSettings')
const UserSettings = require('../../../lib/user/UserSettings')
const portfinder = require('portfinder')

const proxyquire = require('proxyquire')

class SocketIOMock extends EventEmitter {
  connect () { this.emit('connect') }

  disconnect () { this.disconnected = true }

  removeListener () {}
}

describe('BackendProcess', () => {
  let backendProcess
  let stepExecutor
  let userTestFolder
  let appTestFolder
  let userSettings
  let appSettings
  let logger

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
      start: () => sinon.stub().resolves(),
      stop: () => sinon.stub().resolves(),
      startWatcher: () => sinon.stub().resolves(),
      stopWatcher: () => sinon.stub().resolves()
    }

    portfinder.getPort((err, port) => {
      assert.ifError(err)

      process.env.SGCLOUD_DC_ADDRESS = `http://localhost:${port}`
      logger = {info: () => {}, error: () => {}, debug: () => {}}
      backendProcess = new BackendProcess(userSettings, appSettings, logger)
      backendProcess.executor = stepExecutor
      done()
    })
  })

  afterEach(async () => {
    delete process.env.SGCLOUD_DC_ADDRESS
    delete process.env.APP_PATH
    delete process.env.USER_PATH

    socketIOMock.removeAllListeners()

    return Promise.all([
      fsEx.remove(appTestFolder),
      fsEx.remove(userTestFolder),
      backendProcess.disconnect()
    ])
  })

  describe('select application', () => {
    it('should select an application', async () => {
      let wasCalled = 0
      socketIOMock.on('selectApplication', (data, cb) => {
        assert.deepEqual(data, {applicationId: 'shop_10006'})
        cb()
        wasCalled++
      })

      await backendProcess.connect()
      await backendProcess.selectApplication('shop_10006')

      assert.equal(wasCalled, 1)
    })

    it('should fail if socket sends error', async () => {
      socketIOMock.on('selectApplication', (data, cb) => {
        const err = new Error('Forbidden')
        err.code = 403
        cb(err)
      })

      try {
        await backendProcess.connect()
        await backendProcess.selectApplication('123')
      } catch (err) {
        assert.ok(err)
        assert.equal(err.code, 403)
        assert.equal(err.message, 'Forbidden')
      }
    })

    it('should fail if socket sends error (reset)', async () => {
      socketIOMock.on('selectApplication', (data, cb) => {
        assert.deepEqual(data, {applicationId: 'shop_10006'})
        cb()
      })

      socketIOMock.on('reset', (data, cb) => cb(new Error('error')))

      try {
        await backendProcess.connect()
        await backendProcess.selectApplication('shop_10006')
      } catch (err) {
        assert.ok(err)
        assert.equal(err.message, 'error')
      }
    })

    it('should fail if socket sends error (reload)', async () => {
      socketIOMock.on('selectApplication', (data, cb) => {
        assert.deepEqual(data, {applicationId: 'shop_10006'})
        cb()
      })

      socketIOMock.on('reset', (data, cb) => cb())
      socketIOMock.on('reload', (data, cb) => cb(new Error('error')))

      try {
        await backendProcess.connect()
        await backendProcess.selectApplication('shop_10006')
      } catch (err) {
        assert.ok(err)
        assert.equal(err.message, 'error')
      }
    })

    it('should forward on extensions attach', async () => {
      let wasCalled = 0
      socketIOMock.on('registerExtension', (data, cb) => {
        assert.deepEqual(data, {extensionId: 'testExt', trusted: false})
        cb()
        wasCalled++
      })

      await backendProcess.connect()
      await backendProcess.attachExtension({id: 'testExt', trusted: false})

      assert.equal(wasCalled, 1)
    })

    it('should forward on extensions detach', async () => {
      let wasCalled = 0
      socketIOMock.on('deregisterExtension', (data, cb) => {
        assert.deepEqual(data, {extensionId: 'testExt', trusted: false})
        cb()
        wasCalled++
      })

      await backendProcess.connect()
      await backendProcess.detachExtension({id: 'testExt', trusted: false})

      assert.equal(wasCalled, 1)
    })
  })

  describe('attachExtension', () => {
    it('should log an error', (done) => {
      logger.error = (message) => {
        assert.ok(message.startsWith('Error while attaching the extension'))
        done()
      }

      backendProcess._emitToSocket = () => new Promise((resolve, reject) => reject(new Error('error')))

      backendProcess.attachExtension({id: 'null', trusted: false})
    })
  })

  describe('detachExtension', () => {
    it('should log an error', (done) => {
      logger.error = (message) => {
        assert.ok(message.startsWith('Error while detaching the extension'))
        done()
      }

      backendProcess._emitToSocket = () => new Promise((resolve, reject) => reject(new Error('error')))

      backendProcess.detachExtension({id: 'null', trusted: false})
    })
  })

  describe('update token', () => {
    const token = {foo: 'bar'}

    it('should update the token', () => {
      backendProcess.updateToken(token)
      assert.deepEqual(userSettings.getToken(), token)
    })
  })
})
