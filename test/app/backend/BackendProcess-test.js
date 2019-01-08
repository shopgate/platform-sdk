const assert = require('assert')
const EventEmitter = require('events')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const portfinder = require('portfinder')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const { promisify } = require('util')
const config = require('../../../lib/config')
const UserSettings = require('../../../lib/user/UserSettings')

class SocketIOMock extends EventEmitter {
  connect () { this.emit('connect') }

  disconnect () { this.disconnected = true }

  removeListener () {}
}

describe('BackendProcess', () => {
  let tempDir
  let backendProcess
  let stepExecutor
  let userTestFolder
  let appTestFolder
  let userSettings
  let logger

  const socketIOMock = new SocketIOMock()

  const BackendProcess = proxyquire('../../../lib/app/backend/BackendProcess', {
    'socket.io-client': () => socketIOMock
  })

  before(async () => {
    tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    userTestFolder = path.join(tempDir, 'user')
    appTestFolder = path.join(tempDir, 'app')
    config.load({ userDirectory: userTestFolder })
  })

  beforeEach(async () => {
    userSettings = await new UserSettings().setToken({})

    stepExecutor = {
      start: () => sinon.stub().resolves(),
      stop: () => sinon.stub().resolves(),
      startWatcher: () => sinon.stub().resolves(),
      stopWatcher: () => sinon.stub().resolves(),
      execute: (input, stepMetaData, cb) => cb(null, null)
    }

    portfinder.getPort((err, port) => {
      assert.ifError(err)

      process.env.SGCLOUD_DC_ADDRESS = `http://localhost:${port}`
      logger = { info: () => {}, error: () => {}, debug: () => {} }
      backendProcess = new BackendProcess(userSettings, logger)
      backendProcess.executor = stepExecutor
    })
  })

  afterEach(async () => {
    delete process.env.SGCLOUD_DC_ADDRESS
    delete process.env.APP_PATH
    delete process.env.USER_PATH

    socketIOMock.removeAllListeners()

    await Promise.all([
      fsEx.remove(appTestFolder),
      fsEx.remove(userTestFolder),
      backendProcess.disconnect()
    ])
  })

  after(async () => fsEx.remove(tempDir))

  describe('connect', () => {
    it('should react to all events', (done) => {
      let warnWasCalled = false
      let errorWasCalled = false
      let stepCallWasCalled = false
      let updateTokenWasCalled = false

      logger.warn = (message) => {
        assert.equal(message, 'Connection error! Trying to reconnect...')
        warnWasCalled = true
      }

      logger.error = (err) => {
        assert.equal(err.message, 'error')
        errorWasCalled = true
      }

      backendProcess.stepCall = (data) => {
        assert.deepEqual(data, { foo: 'bar' })
        stepCallWasCalled = true
      }

      backendProcess.updateToken = async (data) => {
        assert.deepEqual(data, { foo: 'bar' })
        updateTokenWasCalled = true
      }

      backendProcess.connect().then(() => {
        socketIOMock.emit('connect_error')
        socketIOMock.emit('error', new Error('error'))
        socketIOMock.emit('stepCall', { foo: 'bar' })
        socketIOMock.emit('updateToken', { foo: 'bar' })
        assert.ok(warnWasCalled)
        assert.ok(errorWasCalled)
        assert.ok(stepCallWasCalled)
        assert.ok(updateTokenWasCalled)
        done()
      })
    })
  })

  describe('attachExtension', () => {
    it('should forward on extensions attach', () => {
      let wasCalled = 0
      socketIOMock.on('registerExtension', (data, cb) => {
        assert.deepEqual(data, { extensionId: 'testExt', trusted: false })
        cb()
        wasCalled++
      })

      return backendProcess.connect()
        .then(() => backendProcess.attachExtension({ id: 'testExt', trusted: false }))
        .then(() => {
          assert.equal(wasCalled, 1)
        })
    })

    it('should log an error', (done) => {
      logger.error = (message) => {
        assert.ok(message.startsWith('Error while attaching the extension'))
        done()
      }

      backendProcess._emitToSocket = () => new Promise((resolve, reject) => reject(new Error('error')))

      backendProcess.attachExtension({ id: 'null', trusted: false })
    })
  })

  describe('detachExtension', () => {
    it('should forward on extensions detach', () => {
      let wasCalled = 0
      socketIOMock.on('deregisterExtension', (data, cb) => {
        assert.deepEqual(data, { extensionId: 'testExt', trusted: false })
        cb()
        wasCalled++
      })

      return backendProcess.connect()
        .then(() => backendProcess.detachExtension({ id: 'testExt', trusted: false }))
        .then(() => {
          assert.equal(wasCalled, 1)
        })
    })

    it('should log an error', (done) => {
      logger.error = (message) => {
        assert.ok(message.startsWith('Error while detaching the extension'))
        done()
      }

      backendProcess._emitToSocket = () => new Promise((resolve, reject) => reject(new Error('error')))

      backendProcess.detachExtension({ id: 'null', trusted: false })
    })
  })

  describe('select application', () => {
    it('should select an application', async () => {
      let wasCalled = 0
      socketIOMock.on('selectApplication', (data, cb) => {
        assert.deepEqual(data, { applicationId: 'shop_10006' })
        cb()
        wasCalled++
      })

      await backendProcess.connect()
      await backendProcess.selectApplication('shop_10006')

      assert.equal(wasCalled, 1)
    })

    it('should fail if socket sends error', (done) => {
      socketIOMock.on('selectApplication', (data, cb) => {
        const err = new Error('Forbidden')
        err.code = 403
        cb(err)
      })

      backendProcess.connect()
        .then(() => backendProcess.selectApplication('123'))
        .catch(err => {
          assert.ok(err)
          assert.equal(err.code, 403)
          assert.equal(err.message, 'Forbidden')
          done()
        })
    })
  })

  describe('resetPipelines', () => {
    it('should log `Reset application`', (done) => {
      logger.info = (message) => {
        if (message === 'Establishing SDK connection') return

        assert.equal(message, 'Reset application')
        done()
      }

      socketIOMock.on('resetPipelines', (cb) => cb(null))

      backendProcess.connect()
        .then(() => backendProcess.resetPipelines())
    })

    it('should fail if socket sends error (resetPipelines)', (done) => {
      socketIOMock.on('resetPipelines', (cb) => cb(new Error('error')))

      backendProcess.connect()
        .then(() => backendProcess.resetPipelines())
        .catch(err => {
          assert.ok(err)
          assert.equal(err.message, 'error')
          done()
        })
    })
  })

  describe('reload', () => {
    it('should log `Activated local pipelines on the remote server`', (done) => {
      logger.info = (message) => {
        if (message === 'Establishing SDK connection') return

        assert.equal(message.split('...')[0], 'Activated local pipelines on the remote server')
      }

      socketIOMock.on('reloadPipelines', (cb) => cb(null))

      backendProcess.connect()
        .then(() => backendProcess.reloadPipelineController())
        .then(done)
    })

    it('should fail if socket sends error (reload)', (done) => {
      socketIOMock.on('reloadPipelines', (cb) => cb(new Error('error')))

      backendProcess.connect()
        .then(() => backendProcess.reloadPipelineController())
        .catch(err => {
          assert.ok(err)
          assert.equal(err.message, 'error')
          done()
        })
    })
  })

  describe('startStepExecutor', () => {
    it('should start the step executor', async () => {
      let startCalled = false
      backendProcess.start = () => {
        startCalled = true
      }
      backendProcess.start = () => {
        assert.ok(startCalled)
      }
      return backendProcess.startStepExecutor()
    })
  })

  describe('stepCall', () => {
    it('should call a step', (done) => {
      stepExecutor.execute = (input, stepMetaData, cb) => cb(null, { input, stepMetaData })

      const data = { input: 'i', stepMetaData: 's' }

      backendProcess.stepCall(data, (err, result) => {
        assert.ifError(err)
        assert.deepEqual(data, result)
        done()
      })
    })
  })

  describe('update token', () => {
    const token = { foo: 'bar' }

    it('should update the token', async () => {
      await backendProcess.updateToken(token)
      assert.deepEqual(await userSettings.getToken(), token)
    })
  })

  describe('disconnect', () => {
    it('should fail because executor.stop() fails', () => {
      logger.debug = (message) => {
        assert.equal(message, 'Error: error')
      }

      stepExecutor.stop = () => new Promise((resolve, reject) => reject(new Error('error')))

      return backendProcess.connect()
        .then(() => backendProcess.disconnect())
    })
  })

  describe('disconnectedByOtherUser', () => {
    it('should be called upon incoming "disconnectedByOtherUser" from socket', () => {
      return new Promise((resolve, reject) => {
        backendProcess.disconnectedByOtherUser = reason => {
          try {
            assert.equal(reason, 'reason')
          } catch (err) {
            reject(err)
          }
          resolve()
        }

        backendProcess.connect().then(() => {
          socketIOMock.emit('disconnectedByOtherUser', 'reason')
        })
      })
    })

    it('should call "disconnect(false)" and send SIGINT upon incoming "disconnectedByOtherUser" from socket', () => {
      return new Promise((resolve, reject) => {
        let sigintSent = false
        let disconnectCalled = false

        process.removeAllListeners('SIGINT')

        process.on('SIGINT', () => {
          if (disconnectCalled) resolve()
          sigintSent = true
        })

        backendProcess.disconnect = reconnect => {
          try {
            assert.ok(!reconnect)
          } catch (err) {
            reject(err)
          }

          if (sigintSent) resolve()
          disconnectCalled = !reconnect
        }

        backendProcess.connect().then(() => {
          socketIOMock.emit('disconnectedByOtherUser', 'reason')
        })
      })
    })
  })

  describe('connectionInProgress', () => {
    it('should be called upon incoming "connectionInProgress" from socket', () => {
      return new Promise((resolve, reject) => {
        backendProcess.connectionInProgress = reason => {
          try {
            assert.equal(reason, 'reason')
          } catch (err) {
            reject(err)
          }
          resolve()
        }

        backendProcess.connect().then(() => {
          socketIOMock.emit('connectionInProgress', 'reason')
        })
      })
    })

    it('should call "disconnect(false)" and send SIGINT upon incoming "connectionInProgress" from socket', () => {
      return new Promise((resolve, reject) => {
        let sigintSent = false
        let disconnectCalled = false

        process.removeAllListeners('SIGINT')

        process.on('SIGINT', () => {
          if (disconnectCalled) resolve()
          sigintSent = true
        })

        backendProcess.disconnect = reconnect => {
          try {
            assert.ok(!reconnect)
          } catch (err) {
            reject(err)
          }

          if (sigintSent) resolve()
          disconnectCalled = !reconnect
        }

        backendProcess.connect().then(() => {
          socketIOMock.emit('connectionInProgress', 'reason')
        })
      })
    })
  })
})
