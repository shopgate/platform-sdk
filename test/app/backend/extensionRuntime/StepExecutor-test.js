const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const proxyquire = require('proxyquire').noPreserveCache()
const sinon = require('sinon')
const { promisify } = require('util')
const config = require('../../../../lib/config')
const DcHttpClient = require('../../../../lib/DcHttpClient')
const AppSettings = require('../../../../lib/app/AppSettings')
const { EXTENSIONS_FOLDER, SETTINGS_FOLDER, UNAVAILABLE_UNSUPPORTED } = require('../../../../lib/app/Constants')
const StepExecutor = require('../../../../lib/app/backend/extensionRuntime/StepExecutor')
const UserSettings = require('../../../../lib/user/UserSettings')

let forkMock = () => (true)

describe('StepExecutor', () => {
  let tempDir
  let userDir
  let appPath

  before(async () => {
    tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    userDir = path.join(tempDir, 'user')
    appPath = path.join(tempDir, 'app')
    config.load({ userDirectory: userDir })
  })

  after(async () => {
    await fsEx.remove(tempDir)
  })

  describe('watcher', () => {
    const attachedExtensions = {
      '@shopgate/attachedExt': { path: 'attachedExt' },
      '@shopgate/otherAttachedExt': { path: 'otherAttachedExt' }
    }
    let appSettingsMock
    let pathes

    // 'ready' is fired as soon as it is subscribed to, because startWatcher() resolves on it.
    const createWatcherMock = () => ({
      closed: false,
      closeCalls: 0,
      events: {},
      close: function () {
        this.closeCalls++
        this.closed = true
      },
      on: function (event, fn) {
        this.events[event] = fn
        if (event === 'ready') fn()
        return this
      },
      emit: function (event, param1, param2) {
        this.events[event](param1, param2)
      },
      removeAllListeners: () => {}
    })

    beforeEach(async () => {
      appSettingsMock = {
        getApplicationFolder: () => appPath,
        loadAttachedExtensions: async () => attachedExtensions
      }
      pathes = Object.values(attachedExtensions)
        .map(extension => path.join(appPath, EXTENSIONS_FOLDER, extension.path, 'extension'))

      for (const folder of pathes) await fsEx.ensureDir(folder)
    })

    afterEach(async () => fsEx.remove(path.join(appPath, EXTENSIONS_FOLDER)))

    // Uses real chokidar: the mock always fires 'ready', so it cannot reproduce the empty case.
    it('should start with no attached extensions and still watch after a restart', async function () {
      this.timeout(10000)
      const stepExecutor = new StepExecutor({ info: () => {} }, {
        getApplicationFolder: () => appPath,
        loadAttachedExtensions: async () => ({})
      })

      // chokidar never becomes ready for an empty path list, so this would hang
      await stepExecutor.startWatcher()
      assert.deepEqual(Object.keys(stepExecutor.watcher.getWatched()), [])

      stepExecutor.appSettings.loadAttachedExtensions = async () => attachedExtensions
      await stepExecutor.stopWatcher()
      await stepExecutor.startWatcher()

      assert.deepEqual(await stepExecutor._getStepFolders(), pathes)
      await stepExecutor.stopWatcher()
    })

    it('should not be disabled by ignored segments in the project path', async () => {
      // matching an absolute path would also match the project's own location, e.g. a checkout
      // inside a hidden directory, and silently ignore everything below it
      const nested = path.join(appPath, '.hidden', 'project')
      const stepFolder = path.join(nested, EXTENSIONS_FOLDER, 'attachedExt', 'extension')
      await fsEx.ensureDir(stepFolder)
      const stepExecutor = new StepExecutor({ info: () => {} }, {
        getApplicationFolder: () => nested,
        loadAttachedExtensions: async () => ({ '@shopgate/attachedExt': { path: 'attachedExt' } })
      })

      const { ignored } = stepExecutor.watcherOptions
      const step = path.join(stepFolder, 'step.js')
      await fsEx.writeFile(step, '// step')

      assert.equal(ignored(stepFolder, await fsEx.stat(stepFolder)), false, 'the step folder was ignored')
      assert.equal(ignored(step, await fsEx.stat(step)), false, 'the step file was ignored')
    })

    it('should watch step json but not dependency manifests', async () => {
      const stepFolder = pathes[0]
      const stepExecutor = new StepExecutor({ info: () => {} }, appSettingsMock)
      const { ignored } = stepExecutor.watcherOptions

      const decide = async (name) => {
        const file = path.join(stepFolder, name)
        await fsEx.outputFile(file, '{}')
        return ignored(file, await fsEx.stat(file))
      }

      assert.equal(await decide('step.js'), false)
      // the runtime re-reads config.json on every step call, so changing it needs no restart
      assert.equal(await decide('config.json'), true, 'config.json would restart the runtime')
      assert.equal(await decide('translations.json'), false)
      assert.equal(await decide('package.json'), true, 'package.json would restart the runtime')
      assert.equal(await decide('package-lock.json'), true, 'package-lock.json would restart the runtime')
      assert.equal(await decide('notes.md'), true)
    })

    it('should only watch the step folders of attached extensions', async () => {
      await fsEx.ensureDir(path.join(appPath, EXTENSIONS_FOLDER, 'notAttachedExt', 'extension'))
      const stepExecutor = new StepExecutor({ info: () => {} }, appSettingsMock)

      assert.deepEqual(await stepExecutor._getStepFolders(), pathes)
    })

    // chokidar watches the parent of a path that does not exist yet, so an extension that gains a
    // backend later is covered without restarting the process
    it('should also watch a step folder that does not exist yet', async () => {
      await fsEx.remove(pathes[1])
      const stepExecutor = new StepExecutor({ info: () => {} }, appSettingsMock)

      assert.deepEqual(await stepExecutor._getStepFolders(), pathes)
    })

    it('should pick up a step folder created after the start', async function () {
      this.timeout(15000)
      const late = pathes[1]
      await fsEx.remove(late)
      const stepExecutor = new StepExecutor({ info: () => {} }, appSettingsMock)
      let onRestart
      const restarted = new Promise(resolve => { onRestart = resolve })
      stepExecutor.stop = async () => onRestart()
      stepExecutor.start = async () => {}

      await stepExecutor.startWatcher()
      await new Promise(resolve => setTimeout(resolve, 300))
      await fsEx.outputFile(path.join(late, 'step.js'), '// a backend added later')

      const detected = await Promise.race([
        restarted.then(() => true),
        new Promise(resolve => setTimeout(() => resolve(false), 8000))
      ])
      await stepExecutor.stopWatcher()

      assert.ok(detected, 'a step folder created after the start was not watched')
    })

    it('should start the watcher', (done) => {
      const watcher = createWatcherMock()

      const StepExecutorMocked = proxyquire('../../../../lib/app/backend/extensionRuntime/StepExecutor', {
        chokidar: {
          watch: (actualPath, options) => {
            assert.deepEqual(actualPath, pathes)
            return watcher
          }
        }
      })
      const stepExecutor = new StepExecutorMocked({ info: () => {} }, appSettingsMock)
      stepExecutor.start = sinon.stub().resolves()
      stepExecutor.stop = () => {
        return new Promise((resolve, reject) => {
          done()
          resolve()
        })
      }

      assert.equal(stepExecutor.watcher, undefined)
      stepExecutor.startWatcher().then(() => watcher.emit('all'))
    })

    it('should stop the watcher', async () => {
      const watcher = createWatcherMock()

      const StepExecutorMocked = proxyquire('../../../../lib/app/backend/extensionRuntime/StepExecutor', {
        chokidar: {
          watch: (actualPath, options) => {
            assert.deepEqual(actualPath, pathes)
            return watcher
          }
        }
      })

      const stepExecutor = new StepExecutorMocked({ info: () => {} }, appSettingsMock)

      await stepExecutor.startWatcher()
      await stepExecutor.stopWatcher()

      assert.equal(watcher.closeCalls, 1)
    })
  })

  describe('childProcess', () => {
    let executor
    let log
    let appTestFolder
    let userTestFolder

    let appSettings
    let userSettings
    let dcHttpClient
    let extensionDir

    let basicProcessMock

    before(() => {
      extensionDir = path.join(appPath, EXTENSIONS_FOLDER, 'foobar', 'extension')
    })

    beforeEach(async function () {
      this.timeout(10000)

      basicProcessMock = {
        connected: true,
        on: (code, callback) => {
          callback()
        }
      }
      userTestFolder = path.join(tempDir, 'usersettings')
      config.load({ userDirectory: userTestFolder })
      appTestFolder = path.join(tempDir, 'appsettings')
      process.env.SGCLOUD_DC_WS_ADDRESS = `http://nockedDc`
      process.env.APP_PATH = appTestFolder
      log = { info: () => { }, error: () => { }, debug: () => { }, warn: () => { } }
      appSettings = new AppSettings(appTestFolder)
      await appSettings.setId('shop_123')
      userSettings = new UserSettings().setToken({})
      dcHttpClient = new DcHttpClient(userSettings, log)
      executor = new StepExecutor(log, appSettings, dcHttpClient)
      executor.stepTimeout = 1000
      executor.stepLogger = { info: () => {}, error: () => {}, debug: () => {}, warn: () => {} }

      try {
        await fsEx.ensureDir(path.join(appTestFolder, SETTINGS_FOLDER))
        await fsEx.writeJson(appSettings.attachedExtensionsFile, { attachedExtensions: { '@foo/bar': { path: 'foobar' } } })
        await fsEx.emptyDir(extensionDir)
      } catch (error) {

      }
    })

    afterEach(async () => {
      delete process.env.SGCLOUD_DC_WS_ADDRESS
      delete process.env.APP_PATH
      delete process.env.USER_DIR

      try {
        await Promise.all([
          fsEx.remove(appTestFolder),
          fsEx.remove(userTestFolder)
        ])
      } catch (err) {
        assert.ifError(err)
      } finally {
        executor.childProcess = {}
        executor.childProcess.on = (code, callback) => {
          callback()
        }
        await executor.stop()
      }
    })

    it('should not start another childProcess when one is already running', async () => {
      try {
        executor.childProcess = true
        await executor.start()
      } catch (err) {
        assert.equal(err.message, 'childProcess already running')
      }
    })

    it('should call a local step action', (done) => {
      const input = { foo: 'bar' }
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/simple.js',
        meta: { appId: 'shop_123' }
      }
      basicProcessMock.send = (given) => {
        assert.equal(input, given.input)
        assert.equal(stepMeta, given.stepMeta)
        const callId = Object.keys(executor.openCalls)[0]
        clearTimeout(executor.openTimeouts[callId])
        done()
      }
      executor.childProcess = basicProcessMock
      executor.onExit = () => { }
      executor.execute(input, stepMeta, (err, output) => {
        assert.ifError(err)
        assert.fail()
      })
    })

    it('should callback error', (done) => {
      const input = { foo: 'bar', bar: { nestedFoo: 'nestedBar' } }
      const callId = 1
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/promise-reject.js',
        meta: { appId: 'shop_123' }
      }
      const err = { name: 'Error', message: 'crashed ' + stepMeta.meta.appId }
      Object.assign(err, input)

      const type = 'output'
      const level = 'debug'
      const output = null
      executor.openCalls[callId] = (caughtErr, returnedOutput) => {
        assert.deepEqual(caughtErr, Object.assign({ name: 'Error', message: 'crashed ' + stepMeta.meta.appId }, input))
        done()
      }
      executor.latestStepMeta = stepMeta
      executor.onMessage({ type, arguments, level, callId, output, err })
    })

    it('should callback error of promise step (with all fields)', (done) => {
      const callId = 1
      const output = { 'key': 'value' }
      const type = 'output'
      const level = 'debug'
      const err = null
      executor.openCalls[callId] = (caughtErr, returnedOutput) => {
        assert.equal(returnedOutput, output)
        done()
      }
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/promise-reject.js',
        meta: { appId: 'shop_123' }
      }
      executor.latestStepMeta = stepMeta
      executor.onMessage({ type, arguments, level, callId, output, err })
    })

    it('should crash and recover if step crashed', (done) => {
      executor.childProcess = {}
      executor.childProcess.stop = false

      executor.start = () => {
        assert.equal(executor.childProcess, undefined)
        done()
      }

      executor.onExit(1, '')
    })

    it('should timeout', (done) => {
      executor.childProcess = basicProcessMock
      executor.childProcess.send = () => { }
      const stepMeta = {
        id: '@foo/bar',
        path: '@foo/bar/timeout.js',
        meta: { appId: 'shop_123' }
      }
      executor.onExit = () => { }
      executor.execute({}, stepMeta, (err) => {
        assert.ok(err)
        assert.equal(err.message, `Step '${stepMeta.path}' timeout`)
        assert.equal(err.code, 'ETIMEOUT')
        done()
      })
    })

    it('should start the sub process with "--inspect" if requested', async () => {
      const listeners = []
      forkMock = () => {
        return {
          on: (event, cb) => {
            if (event === 'message') {
              const data = { ready: true }
              return cb(data)
            }
            listeners.push({ event, cb })
          }
        }
      }
      const StepExecutorMocked = proxyquire('../../../../lib/app/backend/extensionRuntime/StepExecutor', {
        child_process: {
          fork: (program, args, { execArgv }) => {
            assert.ok(execArgv.includes('--inspect'))
            return forkMock(program, execArgv, args)
          }
        }
      })

      const executor = new StepExecutorMocked(
        { info: () => { }, warn: () => { }, debug: () => { } },
        { getApplicationFolder: () => appPath },
        {},
        true
      )
      await executor.start()

      const listeningToEvents = listeners.map(object => (object.event))
      assert.ok(listeningToEvents.includes('error'))
      assert.ok(listeningToEvents.includes('exit'))
      assert.ok(listeningToEvents.includes('disconnect'))
    })

    it('should send the DC response back to child process upon incoming request', (done) => {
      const expectedResourceName = 'some resource'
      const expectedAppId = 'shop_1337'
      const expectedDeviceId = 'shop_1773'

      const expectedInformation = { information: 'whatever DC may return' }
      const expectedRequestId = '1337'

      dcHttpClient.getInfos = (infoType, appId, deviceId) => {
        assert.equal(infoType, expectedResourceName)
        assert.equal(appId, expectedAppId)
        assert.equal(deviceId, expectedDeviceId)

        return expectedInformation
      }

      executor.childProcess = {
        send: message => {
          assert.equal(message.type, 'dcResponse')
          assert.equal(message.requestId, expectedRequestId)
          assert.equal(message.info, expectedInformation)
          done()
        }
      }

      executor.onMessage({
        type: 'dcRequest',
        dcRequest: {
          resourceName: expectedResourceName,
          appId: expectedAppId,
          deviceId: expectedDeviceId,
          requestId: expectedRequestId
        }
      })
    })

    it('should start the sub process without "--inspect" if not requested', async () => {
      const listeners = []
      forkMock = () => {
        return {
          on: (event, cb) => {
            if (event === 'message') {
              const data = { ready: true }
              return cb(data)
            }
            listeners.push({ event, cb })
          }
        }
      }
      const StepExecutorMocked = proxyquire('../../../../lib/app/backend/extensionRuntime/StepExecutor', {
        child_process: {
          fork: (program, args, { execArgv }) => {
            assert.ok(!execArgv.includes('--inspect'))
            return forkMock(program, execArgv, args)
          }
        }
      })

      const executor = new StepExecutorMocked(
        { info: () => { }, warn: () => { }, debug: () => { } },
        { getApplicationFolder: () => appPath },
        {},
        false
      )
      await executor.start()

      const listeningToEvents = listeners.map(object => (object.event))
      assert.ok(listeningToEvents.includes('error'))
      assert.ok(listeningToEvents.includes('exit'))
      assert.ok(listeningToEvents.includes('disconnect'))
    })

    describe('encryption keys', () => {
      /**
       * Builds an executor around the given encryption keys and returns it together with a
       * `forkEnvs` array collecting the env of every child that gets forked.
       */
      const buildExecutor = (encryptionKeys) => {
        const forkEnvs = []
        const dcHttpClient = { getEncryptionKeys: sinon.stub().rejects(new Error('must not be called')) }

        // Behaves like a real child for the stop() flow: kill() fires the registered exit
        // listeners, which lets the executor drop its reference and accept a second start().
        forkMock = () => {
          const listeners = {}
          const child = {
            connected: true,
            on: (event, cb) => {
              if (event === 'message') {
                const data = { ready: true }
                return cb(data)
              }
              listeners[event] = (listeners[event] || []).concat(cb)
            },
            disconnect: () => { child.connected = false },
            kill: () => (listeners.exit || []).forEach(cb => cb(null, 'SIGINT'))
          }

          return child
        }

        const StepExecutorMocked = proxyquire('../../../../lib/app/backend/extensionRuntime/StepExecutor', {
          child_process: {
            fork: (program, args, options) => {
              forkEnvs.push(options.env)
              return forkMock()
            }
          }
        })

        const executor = new StepExecutorMocked(
          { info: () => { }, warn: () => { }, debug: () => { } },
          { getApplicationFolder: () => appPath, getId: async () => 'shop_1337' },
          dcHttpClient,
          false,
          encryptionKeys
        )

        return { executor, forkEnvs, dcHttpClient }
      }

      it('should pass the loaded keys to the child process', async () => {
        const keys = [{ alias: 'PARTNER_A', publicKeyPem: 'pem' }]
        const { executor, forkEnvs } = buildExecutor({ keys, unavailableReason: '' })

        await executor.start()

        assert.equal(forkEnvs[0].ENCRYPTION_PUBLIC_KEYS, JSON.stringify(keys))
        assert.equal(forkEnvs[0].ENCRYPTION_KEYS_UNAVAILABLE, '')
      })

      it('should pass the reason on to the child process when no keys are available', async () => {
        const { executor, forkEnvs } = buildExecutor({ keys: [], unavailableReason: UNAVAILABLE_UNSUPPORTED })

        await executor.start()

        assert.equal(forkEnvs[0].ENCRYPTION_PUBLIC_KEYS, '[]')
        assert.equal(forkEnvs[0].ENCRYPTION_KEYS_UNAVAILABLE, UNAVAILABLE_UNSUPPORTED)
      })

      it('should reuse the keys on a restart instead of loading them again', async () => {
        const keys = [{ alias: 'PARTNER_A', publicKeyPem: 'pem' }]
        const { executor, forkEnvs, dcHttpClient } = buildExecutor({ keys, unavailableReason: '' })

        await executor.start()
        await executor.stop()
        await executor.start()

        assert.equal(forkEnvs.length, 2)
        assert.equal(forkEnvs[1].ENCRYPTION_PUBLIC_KEYS, JSON.stringify(keys))
        assert.equal(forkEnvs[1].ENCRYPTION_KEYS_UNAVAILABLE, '')
        assert.ok(dcHttpClient.getEncryptionKeys.notCalled, 'a restart must not fetch the keys again')
      })
    })

    it('should stop the connected child process if stop() is called', () => {
      return new Promise((resolve, reject) => {
        const executor = new StepExecutor(log, appSettings, dcHttpClient, false)
        let onCalled = false
        let disconnectCalled = false
        let killCalled = false

        executor.childProcess = {
          connected: true,
          on: event => {
            try {
              assert.equal(event, 'exit')
            } catch (err) {
              reject(err)
            }

            if (disconnectCalled && killCalled) resolve()
            onCalled = true
          },
          disconnect: () => {
            if (onCalled && killCalled) resolve()

            disconnectCalled = true
          },
          kill: (signal) => {
            try {
              assert.equal(signal, 'SIGINT')
            } catch (err) {
              reject(err)
            }

            if (onCalled && disconnectCalled) resolve()
            killCalled = true
          }
        }

        executor.stop()
      })
    })
  })
})
