const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const async = require('neo-async')
const glob = require('glob')
const sinon = require('sinon')
const StepExecutor = require('../../../../lib/app/backend/extensionRuntime/StepExecutor')
const AppSettings = require('../../../../lib/app/AppSettings')
const UserSettings = require('../../../../lib/user/UserSettings')
const utils = require('../../../../lib/utils/utils')
const appPath = path.join('build', 'appsettings')
const proxyquire = require('proxyquire').noPreserveCache()
const { EXTENSIONS_FOLDER } = require('../../../../lib/app/Constants')

describe('StepExecutor', () => {
  describe('watcher', () => {
    it('should start the watcher', (done) => {
      const watcher = {
        events: {},
        on: function (event, fn) {
          this.events[event] = fn
        },
        emit: function (event, param1, param2, cb) {
          this.events[event](param1, param2)
        }
      }

      const pathes = [
        path.join(utils.getApplicationFolder(), 'extensions', '**', 'extension', '*.js'),
        path.join(utils.getApplicationFolder(), 'extensions', '**', 'extension', '**', '*.js')
      ]

      const StepExecutorMocked = proxyquire('../../../../lib/app/backend/extensionRuntime/StepExecutor', {
        chokidar: {
          watch: (actualPath, options) => {
            assert.deepEqual(actualPath, pathes)
            return watcher
          }
        }
      })
      const stepExecutor = new StepExecutorMocked({info: () => {}}, {getApplicationFolder: utils.getApplicationFolder})
      stepExecutor.start = sinon.stub().resolves()
      stepExecutor.stop = () => {
        return new Promise((resolve, reject) => {
          done()
          resolve()
        })
      }

      assert.equal(stepExecutor.watcher, undefined)

      stepExecutor.startWatcher().then(() => watcher.emit('all'))

      watcher.emit('ready')
    })

    it('should stop the watcher', () => {
      let called = 0
      const watcher = {
        closed: false,
        close: function () {
          called++
          this.closed = true
        },
        events: {},
        on: function (event, fn) {
          this.events[event] = fn
        },
        emit: function (event, param1, param2, cb) {
          this.events[event](param1, param2)
        },
        removeAllListeners: () => {}
      }

      const pathes = [
        path.join(utils.getApplicationFolder(), 'extensions', '**', 'extension', '*.js'),
        path.join(utils.getApplicationFolder(), 'extensions', '**', 'extension', '**', '*.js')
      ]

      const StepExecutorMocked = proxyquire('../../../../lib/app/backend/extensionRuntime/StepExecutor', {
        chokidar: {
          watch: (actualPath, options) => {
            assert.deepEqual(actualPath, pathes)
            return watcher
          }
        }
      })

      const stepExecutor = new StepExecutorMocked({info: () => {}}, {getApplicationFolder: utils.getApplicationFolder})

      stepExecutor.startWatcher()
      watcher.emit('ready')

      return stepExecutor.stopWatcher().then(() => assert.equal(called, 1))
    })
  })

  describe('childProcess', () => {
    let executor
    let log
    let appTestFolder
    let userTestFolder

    beforeEach(function (done) {
      this.timeout(10000)
      userTestFolder = path.join('build', 'usersettings')
      process.env.USER_PATH = userTestFolder
      appTestFolder = path.join('build', 'appsettings')
      process.env.SGCLOUD_DC_WS_ADDRESS = `http://nockedDc`
      process.env.APP_PATH = appTestFolder
      log = {info: () => {}, error: () => {}, debug: () => {}, warn: () => {}}

      executor = new StepExecutor(log)
      executor.stepTimeout = 1000
      executor.stepLogger = {info: () => {}, error: () => {}, debug: () => {}, warn: () => {}}

      new AppSettings().setId('shop_10006')._saveExtensions({'@foo/bar': {path: 'foobar'}})
      new UserSettings().setToken({})

      const extensionDir = path.join(appPath, EXTENSIONS_FOLDER, 'foobar', 'extension')
      fsEx.emptyDirSync(extensionDir)

      glob(path.join(__dirname, 'fakeSteps', '*.js'), {}, (err, files) => {
        assert.ifError(err)
        async.each(files, (file, eCb) => fsEx.copy(file, path.join(extensionDir, path.basename(file)), eCb), (err) => {
          assert.ifError(err)
          executor.start().then(done)
        })
      })
    })

    afterEach((done) => {
      delete process.env.SGCLOUD_DC_WS_ADDRESS
      delete process.env.APP_PATH
      delete process.env.USER_PATH

      async.parallel([
        (cb) => fsEx.remove(appTestFolder, cb),
        (cb) => fsEx.remove(userTestFolder, cb)
      ], err => {
        assert.ifError(err)
        executor.stop().then(done)
      })
    })

    it('should not start another childProcess when one is already running', () => {
      executor.onExit = () => {}
      return executor.start().catch(err => {
        assert.equal(err.message, 'childProcess already running')
      })
    })

    it('should call a local step action', (done) => {
      const input = {foo: 'bar'}
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/simple.js',
        meta: {appId: 'shop_123'}
      }
      executor.onExit = () => {}
      executor.execute(input, stepMeta, (err, output) => {
        assert.ifError(err)
        assert.deepEqual(output, input)
        done()
      })
    })

    it('should call a local promise step action', (done) => {
      const input = {foo: 'bar'}
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/promise-resolve.js',
        meta: {appId: 'shop_123'}
      }
      executor.onExit = () => {}
      executor.execute(input, stepMeta, (err, output) => {
        assert.ifError(err)
        assert.deepEqual(output, input)
        done()
      })
    })

    it('should callback error of step (with all fields)', (done) => {
      const input = {foo: 'bar', bar: {nestedFoo: 'nestedBar'}}
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/error.js',
        meta: {appId: 'shop_123'}
      }
      executor.onExit = () => {}
      executor.execute(input, stepMeta, (err, output) => {
        assert.deepEqual(err, Object.assign({name: 'Error', message: 'crashed ' + stepMeta.meta.appId}, input))
        assert.equal(output, undefined)
        done()
      })
    })

    it('should callback error of promise step (with all fields)', (done) => {
      const input = {foo: 'bar', bar: {nestedFoo: 'nestedBar'}}
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/promise-reject.js',
        meta: {appId: 'shop_123'}
      }
      executor.onExit = () => {}
      executor.execute(input, stepMeta, (err, output) => {
        assert.equal(err.message, 'error')
        assert.equal(output, undefined)
        done()
      })
    })

    it('should fail if step file is not existent', (done) => {
      const input = {foo: 'bar'}
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/notThere.js',
        meta: {appId: 'shop_123'}
      }
      executor.onExit = () => {}
      executor.execute(input, stepMeta, (err) => {
        assert.ok(err)
        assert.ok(err.message.endsWith('notThere.js not found'))
        done()
      })
    })

    it('should fail if step file contains a syntax error', (done) => {
      const input = {foo: 'bar'}
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/crashing2.js',
        meta: {appId: 'shop_123'}
      }

      let exitCalled = false
      executor.start = (cb) => {
        assert.equal(executor.childProcess, undefined)
        assert.ok(exitCalled)
        done()
      }

      const onExit = executor.onExit.bind(executor)
      executor.onExit = (code, signal) => {
        if (!exitCalled) {
          assert.equal(code, 1)
          assert.equal(signal, null)
        }
        assert.ok(executor.childProcess)
        exitCalled = true
        onExit(code, signal)
      }

      executor.execute(input, stepMeta, (err) => {
        assert.ok(err)
        assert.equal(err.message, 'Cannot read property \'notThere\' of undefined')
      })
    })

    it('should fail if step file is invalid', (done) => {
      const input = {foo: 'bar'}
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/crashing3.js',
        meta: {appId: 'shop_123'}
      }

      let exitCalled = false
      executor.start = (cb) => {
        assert.equal(executor.childProcess, undefined)
        assert.ok(exitCalled)
        done()
      }

      const onExit = executor.onExit.bind(executor)
      executor.onExit = (code, signal) => {
        if (!exitCalled) {
          assert.equal(code, 1)
          assert.equal(signal, null)
        }
        assert.ok(executor.childProcess)
        exitCalled = true
        onExit(code, signal)
      }

      executor.execute(input, stepMeta, (err) => {
        assert.ok(err)
        assert.equal(err.message, 'Unexpected token (')
      })
    })

    it('should fail if module.exports is missing in step file', (done) => {
      const input = {foo: 'bar'}
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/crashing4.js',
        meta: {appId: 'shop_123'}
      }

      let exitCalled = false
      executor.start = (cb) => {
        assert.equal(executor.childProcess, undefined)
        assert.ok(exitCalled)
        done()
      }

      const onExit = executor.onExit.bind(executor)
      executor.onExit = (code, signal) => {
        if (!exitCalled) {
          assert.equal(code, 1)
          assert.equal(signal, null)
        }
        assert.ok(executor.childProcess)
        exitCalled = true
        onExit(code, signal)
      }

      executor.execute(input, stepMeta, (err) => {
        assert.ok(err)
        assert.equal(err.message, 'Can\'t find step function; did you export a step function like \'module.exports = function ([error,] context, input, callback) {...}\'?')
      })
    })

    it('should crash and recover if step crashed', (done) => {
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/crashing.js',
        meta: {appId: 'shop_123'}
      }

      let exitCalled = false
      executor.start = (cb) => {
        assert.equal(executor.childProcess, undefined)
        assert.ok(exitCalled)
        done()
      }

      const onExit = executor.onExit.bind(executor)
      executor.onExit = (code, signal) => {
        if (!exitCalled) {
          assert.equal(code, 1)
          assert.equal(signal, null)
        }
        assert.ok(executor.childProcess)
        exitCalled = true
        onExit(code, signal)
      }

      executor.execute({}, stepMeta, assert.ok)
    })

    it('should timeout', (done) => {
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/timeout.js',
        meta: {appId: 'shop_123'}
      }
      executor.onExit = () => {}
      executor.execute({}, stepMeta, (err) => {
        assert.ok(err)
        assert.equal(err.message, `Step '${stepMeta.path}' timeout`)
        assert.equal(err.code, 'ETIMEOUT')
        done()
      })
    })

    it('should start the sub process with "--inspect" if requested', async () => {
      // stop the executor from beforeEach as we're going to instantiate our own
      await executor.stop()

      executor = new StepExecutor(log, {}, true)
      await executor.start()

      if (!executor.childProcess.spawnargs.reduce((val, current) => val || current === '--inspect', false)) {
        await executor.stop()
        assert.fail('Expected child process to be spawned with the "--inspect" argument.')
      }
    })

    it('should start the sub process without "--inspect" if not requested', async () => {
      // stop the executor from beforeEach as we're going to instantiate our own
      await executor.stop()

      executor = new StepExecutor(log, {}, false)
      await executor.start()

      if (executor.childProcess.spawnargs.reduce((val, current) => val || current === '--inspect', false)) {
        await executor.stop()
        assert.fail('Expected child process to be spawned with the "--inspect" argument.')
      }
    })
  })
})
