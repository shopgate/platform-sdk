const assert = require('assert')
const path = require('path')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const fs = require('fs-extra')

const StepExecutor = require('../../../../lib/app/backend/extensionRuntime/StepExecutor')
const AppSettings = require('../../../../lib/app/AppSettings')
const UserSettings = require('../../../../lib/user/UserSettings')
const appPath = path.join('test', 'appsettings')
const proxyquire = require('proxyquire').noPreserveCache()

describe('StepExecutor', () => {
  let executor
  let log
  let appTestFolder

  beforeEach((done) => {
    appTestFolder = path.join('test', 'appsettings')
    process.env.SGCLOUD_DC_WS_ADDRESS = `http://nockedDc`
    process.env.APP_PATH = appTestFolder
    log = {info: () => {}, error: () => {}, debug: () => {}, warn: () => {}}
    executor = new StepExecutor(log)
    executor.stepTimeout = 1000

    const appSettings = new AppSettings()
    mkdirp.sync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    mkdirp.sync(path.join(appPath, AppSettings.EXTENSIONS_FOLDER, 'foobar', 'extension'))
    appSettings.setId('shop_10006').setAttachedExtensions({'@foo/bar': {path: 'foobar'}}).save().init()
    AppSettings.setInstance(appSettings)
    UserSettings.getInstance().getSession().token = {}

    const fakeStepDir = path.join(__dirname, 'fakeSteps')
    const extensionDir = path.join(appPath, AppSettings.EXTENSIONS_FOLDER, 'foobar', 'extension')
    fs.copySync(path.join(fakeStepDir, 'simple.js'), path.join(extensionDir, 'simple.js'))
    fs.copySync(path.join(fakeStepDir, 'crashing.js'), path.join(extensionDir, 'crashing.js'))
    fs.copySync(path.join(fakeStepDir, 'timeout.js'), path.join(extensionDir, 'timeout.js'))

    executor.start(done)
  })

  afterEach((done) => {
    delete process.env.SGCLOUD_DC_WS_ADDRESS
    delete process.env.APP_PATH
    rimraf(appTestFolder, (err) => {
      assert.ifError(err)
      executor.stop(done)
    })
  })

  describe('watcher', () => {
    it('should start the watcher', (done) => {
      let eventCount = 0
      const watcher = {
        on: (event, cb) => {
          if (eventCount++ === 0) {
            assert.equal(event, 'ready')
          } else {
            assert.equal(stepExecutor.watcher, watcher)
            assert.equal(event, 'all')
          }
          cb()
        }
      }
      const opts = {}
      const StepExecutorMocked = proxyquire('../../../../lib/app/backend/extensionRuntime/StepExecutor', {
        chokidar: {
          watch: (path, options) => {
            assert.equal(path, 'extensions')
            assert.equal(options, opts)
            return watcher
          }
        }
      })
      const stepExecutor = new StepExecutorMocked({info: () => {}}, opts)
      assert.equal(stepExecutor.watcher, undefined)
      stepExecutor.stop = (cb) => {
        cb()
      }
      stepExecutor.start = () => {
        done()
      }
      stepExecutor.watch()
    })
  })

  it('should call a local step action', (done) => {
    const input = {foo: 'bar'}
    const stepMeta = {
      id: '@foo/bar',
      path: '@foo/bar/simple.js',
      meta: {appId: 'shop_123'}
    }
    executor.execute(input, stepMeta, (err, output) => {
      assert.ifError(err)
      assert.deepEqual(output, input)
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
    executor.execute(input, stepMeta, (err) => {
      assert.ok(err)
      assert.ok(err.message.endsWith('notThere.js" not found'))
      done()
    })
  })

  it('should crash and recover if step crashed', (done) => {
    const stepMeta = {
      id: '@foo/bar',
      path: '@foo/bar/crashing.js',
      meta: {appId: 'shop_123'}
    }

    const start = executor.start.bind(executor)
    let exitCalled = false
    executor.start = (cb) => {
      assert.ok(exitCalled)
      start(done)
    }

    const onExit = executor.onExit.bind(executor)
    executor.onExit = (code, signal) => {
      if (!exitCalled) {
        assert.equal(code, 1)
        assert.equal(signal, null)
      }
      exitCalled = true
      onExit(code, signal)
    }

    executor.execute({}, stepMeta, assert.ok)
  })

  it('should timout', (done) => {
    const stepMeta = {
      id: '@foo/bar',
      path: '@foo/bar/timeout.js',
      meta: {appId: 'shop_123'}
    }
    executor.execute({}, stepMeta, (err) => {
      assert.ok(err)
      assert.equal(err.message, 'Step timeout')
      done()
    })
  })
})
