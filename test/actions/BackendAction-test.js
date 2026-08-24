const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const { promisify } = require('util')
const DcHttpClient = require('../../lib/DcHttpClient')
const AppSettings = require('../../lib/app/AppSettings')
const { SETTINGS_FOLDER, EXTENSIONS_FOLDER, UNAVAILABLE_UNSUPPORTED, UNAVAILABLE_FAILED } = require('../../lib/app/Constants')
const { NotFoundError } = require('../../lib/errors')
const config = require('../../lib/config')
const UserSettings = require('../../lib/user/UserSettings')

describe('BackendAction', () => {
  /**
   * @type {BackendAction}
   */
  let subjectUnderTest
  let tempDir
  let userSettingsFolder
  let appPath

  const utils = proxyquire('../../lib/utils/utils', {
    '../logger': {
      info: (param) => { info(param) },
      error: (param) => { error(param) },
      debug: (param) => { debug(param) }
    }
  })

  const BackendAction = proxyquire('../../lib/actions/BackendAction', {
    '../logger': {
      info: (param) => { info(param) },
      error: (param) => { error(param) },
      debug: (param) => { debug(param) },
      warn: (param) => { warn(param) }
    },
    '../utils/utils': utils
  })

  let appSettings
  let userSettings
  let dcHttpClient

  let info
  let error
  let debug
  let warn

  before(async () => {
    tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    userSettingsFolder = path.join(tempDir, 'user')
    appPath = path.join(tempDir, 'app')
    config.load({ userDirectory: userSettingsFolder })
  })

  beforeEach(async () => {
    process.env.USER_DIR = userSettingsFolder

    await fsEx.emptyDir(userSettingsFolder)
    await fsEx.emptyDir(path.join(appPath, SETTINGS_FOLDER))

    appSettings = await new AppSettings(appPath).setId('foobarTest')
    appSettings.loadAttachedExtensions = sinon.stub().resolves()
    userSettings = await new UserSettings().setToken({})
    dcHttpClient = new DcHttpClient(userSettings, null)
    // run() loads the encryption keys; without this stub every run() test would hit the real DC
    dcHttpClient.getEncryptionKeys = sinon.stub().resolves([])

    subjectUnderTest = new BackendAction(appSettings, userSettings, dcHttpClient)

    await fsEx.emptyDir(subjectUnderTest.pipelinesFolder)

    subjectUnderTest.pipelineWatcher = {
      start: sinon.stub().resolves(),
      close: () => {},
      on: (event, fn) => fn(event, path.join(subjectUnderTest.pipelinesFolder, 'testPipeline.json'))
    }

    subjectUnderTest.extensionConfigWatcher = {
      start: sinon.stub().resolves(),
      on: sinon.stub().resolves(),
      stop: sinon.stub().resolves()
    }

    subjectUnderTest.cliProxy = {
      start: sinon.stub().resolves(),
      close: sinon.stub().resolves()
    }

    subjectUnderTest.attachedExtensionsWatcher = {
      attachedExtensions: []
    }

    subjectUnderTest.dcHttpClient = {}

    info = (param) => {}
    error = (param) => {}
    debug = (param) => {}
    warn = (param) => {}
  })

  afterEach(async () => {
    await subjectUnderTest.pipelineWatcher.close()
    await subjectUnderTest.extensionConfigWatcher.stop()
    delete process.env.IGNORE_EXT_CONFIG_FOR
    delete process.env.USER_DIR
  })

  after(async () => {
    await fsEx.remove(tempDir)
  })

  describe('general', () => {
    it('should register', () => {
      const caporal = {}
      caporal.command = sinon.stub().returns(caporal)
      caporal.description = sinon.stub().returns(caporal)
      caporal.action = sinon.stub().returns(caporal)
      caporal.option = sinon.stub().returns(caporal)

      BackendAction.register(caporal, appSettings, userSettings)

      assert(caporal.command.calledWith('backend start'))
      assert(caporal.description.calledOnce)
      assert(caporal.action.calledOnce)
    })

    it('should throw if user not logged in', async () => {
      await userSettings.setToken()
      try {
        await subjectUnderTest.run()
        assert.fail('Expected error to be thrown.')
      } catch (err) {
        assert.equal(err.message, 'You\'re not logged in. Please run `sgconnect login` again.')
      }
    })

    it('should fail because a backend process is already running', (done) => {
      const pid = process.pid
      const processFile = path.join(appPath, SETTINGS_FOLDER)

      utils.setProcessFile('backend', processFile, pid)

      subjectUnderTest.run()
        .catch(err => {
          assert.equal(err.message, `Backend process is already running with pid: ${pid}. Please quit this process first.`)
          done()
        })
    })
  })

  describe('_stop', () => {
    it('should await every watcher it shuts down', async () => {
      const settled = []
      const shutdown = (name, ms) => async () => {
        await new Promise(resolve => setTimeout(resolve, ms))
        settled.push(name)
      }

      // the pipeline watcher outlasts the others on purpose: if it is not awaited, _stop()
      // returns while it is still closing and the assertion below sees it missing
      subjectUnderTest.pipelineWatcher = { close: shutdown('pipelineWatcher', 200) }
      subjectUnderTest.extensionConfigWatcher = { stop: shutdown('extensionConfigWatcher', 10) }
      subjectUnderTest.attachedExtensionsWatcher = { stop: shutdown('attachedExtensionsWatcher', 10) }
      subjectUnderTest.backendProcess = { disconnect: shutdown('backendProcess', 10) }
      subjectUnderTest.cliProxy = { close: shutdown('cliProxy', 10) }

      await subjectUnderTest._stop()

      // a watcher missing from the Promise.all would still be settling here
      assert.equal(settled.length, 5, `only settled: ${settled.join(', ')}`)
      assert.ok(settled.includes('pipelineWatcher'), 'the pipeline watcher was not awaited')
    })
  })

  describe('_pipelineEvent', () => {
    it('should not do anything when the extension is not attached', (done) => {
      subjectUnderTest._pipelineRemoved = sinon.stub().resolves()
      subjectUnderTest._pipelineChanged = sinon.stub().resolves()

      debug = (msg) => {
        assert.equal(msg, 'The extension of the pipeline is not attached --> skip')
        assert.ok(!subjectUnderTest._pipelineRemoved.called, '_pipelineRemoved should not be called')
        assert.ok(!subjectUnderTest._pipelineChanged.called, '_pipelineChanged should not be called')
        done()
      }
      subjectUnderTest._pipelineEvent('test', 'somefile')
    })
  })

  describe('watching', () => {
    beforeEach(() => {
      subjectUnderTest.dcHttpClient = {
        downloadPipelines: sinon.stub().resolves({ pipelines: [{ pipeline: { id: 'testPipeline' } }] }),
        removePipeline: sinon.stub().resolves(),
        clearHooks: sinon.stub().resolves(),
        uploadMultiplePipelines: sinon.stub().resolves()
      }

      subjectUnderTest.writeExtensionConfigs = () => { }
      subjectUnderTest.appSettings.loadAttachedExtensions = () => { return { } }
    })

    it('should update pipelines', (done) => {
      subjectUnderTest.backendProcess = {
        connect: sinon.stub().resolves(),
        selectApplication: sinon.stub().resolves(),
        resetPipelines: sinon.stub().resolves(),
        resetHooks: sinon.stub().resolves(),
        startStepExecutor: sinon.stub().resolves(),
        reloadPipelineController: sinon.stub().resolves()
      }

      subjectUnderTest.attachedExtensionsWatcher = {
        attachedExtensions: [],
        start: () => sinon.stub().resolves(),
        on: () => sinon.stub().resolves()
      }

      subjectUnderTest._updateExtensionConfig = sinon.stub().resolves()

      subjectUnderTest._startSubProcess()
        .then(() => fsEx.readJson(path.join(appPath, 'pipelines', 'testPipeline.json')))
        .then((content) => {
          assert.deepEqual(content, { pipeline: { id: 'testPipeline' } })
          done()
        })
    })

    it('should clear leftover hooks via HTTP before connecting', async () => {
      subjectUnderTest.backendProcess = {
        connect: sinon.stub().resolves(),
        selectApplication: sinon.stub().resolves(),
        resetPipelines: sinon.stub().resolves(),
        resetHooks: sinon.stub().resolves(),
        startStepExecutor: sinon.stub().resolves(),
        reloadPipelineController: sinon.stub().resolves()
      }

      subjectUnderTest.attachedExtensionsWatcher = {
        attachedExtensions: [],
        start: () => sinon.stub().resolves(),
        on: () => sinon.stub().resolves()
      }

      subjectUnderTest._updateExtensionConfig = sinon.stub().resolves()

      await subjectUnderTest._startSubProcess()

      sinon.assert.callOrder(
        subjectUnderTest.dcHttpClient.clearHooks,
        subjectUnderTest.backendProcess.connect,
        subjectUnderTest.backendProcess.selectApplication
      )
      // the socket-based reset became redundant; clearHooks covers it before connecting
      sinon.assert.notCalled(subjectUnderTest.backendProcess.resetHooks)
    })

    it('should not connect when clearing leftover hooks fails', async () => {
      subjectUnderTest.dcHttpClient.clearHooks = sinon.stub().rejects(new Error('dc unreachable'))
      subjectUnderTest.backendProcess = {
        connect: sinon.stub().resolves(),
        selectApplication: sinon.stub().resolves()
      }

      try {
        await subjectUnderTest._startSubProcess()
        assert.fail('Expected error to be thrown.')
      } catch (err) {
        assert.equal(err.message, 'dc unreachable')
      }
      sinon.assert.notCalled(subjectUnderTest.backendProcess.connect)
    })

    it('should stop cleanly even when the best-effort hook cleanup fails', async () => {
      subjectUnderTest.dcHttpClient.clearHooks = sinon.stub().rejects(new Error('dc unreachable'))
      subjectUnderTest.backendProcess = {
        disconnect: sinon.stub().resolves()
      }
      subjectUnderTest.attachedExtensionsWatcher.stop = sinon.stub().resolves()

      await subjectUnderTest._stop()

      sinon.assert.calledOnce(subjectUnderTest.dcHttpClient.clearHooks)
      sinon.assert.calledOnce(subjectUnderTest.backendProcess.disconnect)
    })

    it('should clear hooks best-effort on stop', async () => {
      subjectUnderTest.backendProcess = {
        disconnect: sinon.stub().resolves()
      }
      subjectUnderTest.attachedExtensionsWatcher.stop = sinon.stub().resolves()

      await subjectUnderTest._stop()

      sinon.assert.calledWith(subjectUnderTest.dcHttpClient.clearHooks, 'foobarTest')
      sinon.assert.calledOnce(subjectUnderTest.backendProcess.disconnect)
    })

    it('should fail when pipeline IDs not matching pipeline file names', (done) => {
      appSettings.loadAttachedExtensions = () => { return { testExtension: { path: '..' } } }
      subjectUnderTest.backendProcess = {
        connect: sinon.stub().resolves(),
        selectApplication: sinon.stub().resolves(),
        resetPipelines: sinon.stub().resolves(),
        resetHooks: sinon.stub().resolves(),
        startStepExecutor: sinon.stub().resolves(),
        reloadPipelineController: sinon.stub().resolves()
      }

      subjectUnderTest.dcHttpClient = {
        downloadPipelines: sinon.stub().resolves({ pipelines: [] }),
        removePipeline: sinon.stub().resolves(),
        clearHooks: sinon.stub().resolves(),
        uploadMultiplePipelines: sinon.stub().resolves()
      }

      subjectUnderTest.attachedExtensionsWatcher = {
        attachedExtensions: [{ 'testPipeline123': { path: '' } }],
        start: () => sinon.stub().resolves(),
        on: () => sinon.stub().resolves()
      }

      subjectUnderTest._updateExtensionConfig = sinon.stub().resolves()

      fsEx.writeJson(path.join(appPath, 'pipelines', 'testPipeline.json'), { pipeline: { id: 'testPipeline123' } }, err => {
        assert.ifError(err)

        subjectUnderTest._startSubProcess()
          .then(() => fsEx.readJson(path.join(appPath, 'pipelines', 'testPipeline.json')))
          .then((content) => {
            assert.deepEqual(content, { pipeline: { id: 'testPipeline123' } })
          })
          .catch(err => {
            assert.ok(err)
            assert.equal(
              err.message,
              'Pipeline ID "testPipeline123" and file name "testPipeline" mismatch. The pipeline ID and its file name should match.'
            )
            done()
          })
      })
    })

    it('should call dcClient if pipelines were updated', async () => {
      subjectUnderTest.backendProcess = {
        connect: sinon.stub().resolves(),
        selectApplication: sinon.stub().resolves(),
        resetPipelines: sinon.stub().resolves(),
        startStepExecutor: sinon.stub().resolves(),
        reloadPipelineController: sinon.stub().resolves()
      }

      const pipeline = { pipeline: { id: 'plFooBarline1' } }
      const appId = 'foobarAppIdDcTestBackendAction'
      await appSettings.setId(appId)

      const file = path.join(subjectUnderTest.pipelinesFolder, 'plFooBarline1.json')
      assert.equal(subjectUnderTest.pipelines[file], undefined)

      subjectUnderTest.dcHttpClient.uploadPipeline = async (f, aId) => {
        assert.deepEqual(subjectUnderTest.pipelines[file].id, pipeline.pipeline.id)
        assert.deepEqual(f, pipeline)
        assert.equal(aId, appId)
      }

      await fsEx.writeJson(file, pipeline)
      await subjectUnderTest._pipelineChanged(file)
    })

    it('should write generated extension-config if backend-extension was updated', async () => {
      let generated = { backend: { id: 'myGeneratedExtension' } }

      let called = 0
      subjectUnderTest.dcHttpClient.generateExtensionConfig = () => {
        called++
        return Promise.resolve(generated)
      }

      const cfgPath = path.join(appPath, 'extensions', 'testExt')

      fsEx.ensureDirSync(path.join(cfgPath, 'extension'))

      try {
        await utils.updateExtensionConfig({ file: generated, path: cfgPath }, await subjectUnderTest.appSettings.getId(), subjectUnderTest.dcHttpClient)
        const content = await fsEx.readJson(path.join(cfgPath, 'extension', 'config.json'))
        assert.deepEqual(content, { id: 'myGeneratedExtension' })
        assert.equal(called, 1)
      } catch (err) {
        assert.ifError(err)
      }
    })

    it('should not write generated extension-config if backend-extension was updated but extension is on blacklist', async () => {
      let generated = { id: 'myIgnoredExtension', backend: { id: 'myIgnoredExtension' } }
      process.env.IGNORE_EXT_CONFIG_FOR = 'myIgnoredExtension'

      let calledInfo = false
      info = (msg) => {
        assert.equal('Ignoring extension-config.json of myIgnoredExtension (blacklisted)', msg)
        calledInfo = true
      }

      const cfgPath = path.join(appPath, 'extensions', 'testExt')

      try {
        await utils.updateExtensionConfig({ file: generated, path: cfgPath }, await subjectUnderTest.appSettings.getId(), subjectUnderTest.dcHttpClient)
        assert.ok(calledInfo)
      } catch (err) {
        assert.ifError(err)
      }
    })

    it('should write generated extension-config if frontend-extension was updated', async () => {
      let generated = { frontend: { id: 'myGeneratedExtension' } }

      let called = 0
      subjectUnderTest.dcHttpClient.generateExtensionConfig = () => {
        called++
        return Promise.resolve(generated)
      }

      const cfgPath = path.join(appPath, 'extension', 'testExt')
      fsEx.ensureDirSync(path.join(cfgPath, 'frontend'))

      try {
        await utils.updateExtensionConfig({ file: generated, path: cfgPath }, await subjectUnderTest.appSettings.getId(), subjectUnderTest.dcHttpClient)
        const content = await fsEx.readJson(path.join(cfgPath, 'frontend', 'config.json'))
        assert.deepEqual(content, { id: 'myGeneratedExtension' })
        assert.equal(called, 1)
      } catch (err) {
        assert.ifError(err)
      }
    })

    it('should throw error if dcClient is not reachable', (done) => {
      const pipeline = { pipeline: { id: 'dCPlTest2' } }
      subjectUnderTest.dcHttpClient = {
        uploadPipeline: sinon.stub().rejects(new Error('error'))
      }

      const file = path.join(subjectUnderTest.pipelinesFolder, 'dCPlTest2.json')
      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        subjectUnderTest._pipelineChanged(file).catch(err => {
          assert.ok(err)
          assert.equal(err.message, `error`)
          done()
        })
      })
    })

    it('should return if pipeline was changed', (done) => {
      const pipeline = { pipeline: { id: 'dCPlTest3' } }
      const file = path.join(subjectUnderTest.pipelinesFolder, 'dCPlTest3.json')

      subjectUnderTest.dcHttpClient = {
        uploadPipeline: sinon.stub().resolves(),
        downloadPipelines: sinon.stub().resolves({ pipelines: [{ pipeline: { id: 'testPipeline' } }] })
      }

      subjectUnderTest.backendProcess = {
        connect: sinon.stub().resolves(),
        selectApplication: sinon.stub().resolves(),
        resetPipelines: sinon.stub().resolves(),
        startStepExecutor: sinon.stub().resolves(),
        reloadPipelineController: sinon.stub().resolves()
      }

      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        subjectUnderTest._pipelineChanged(file).then(err => {
          assert.ifError(err)
          done()
        })
      })
    })

    it('should throw an error if pipeline id is not matching with the filename', (done) => {
      const pipeline = { pipeline: { id: 'nonMatchingId' } }

      const file = path.join(subjectUnderTest.pipelinesFolder, 'dCPlTest3.json')
      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        subjectUnderTest._pipelineChanged(file).catch(err => {
          assert.ok(err)
          assert.equal(err.message, `Pipeline ID "${pipeline.pipeline.id}" should match its file name`)
          done()
        })
      })
    })

    it('should throw an error if pipeline is invalid', (done) => {
      const pipeline = {}
      const file = path.join(subjectUnderTest.pipelinesFolder, 'dCPlTest3.json')

      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        subjectUnderTest._pipelineChanged(file).catch(err => {
          assert.ok(err)
          assert.equal(err.message, `Invalid pipeline; check the pipeline.id property in ${file}`)
          done()
        })
      })
    })

    it('should throw an error if pipeline has invalid json', (done) => {
      const pipeline = '{someInvalid: content}'
      const file = path.join(subjectUnderTest.pipelinesFolder, 'dCPlTest5.json')

      fsEx.writeFile(file, pipeline, (err) => {
        assert.ifError(err)
        subjectUnderTest._pipelineChanged(file).catch(err => {
          assert.ok(err)
          assert.equal(err.message, 'Parse error on line 1:\n{someInvalid: content\n-^\nExpecting \'STRING\', \'}\', got \'undefined\'')
          done()
        })
      })
    })

    it('should return if pipeline was removed', (done) => {
      const pipelineId = 'dCPlTest4'
      let called = false
      subjectUnderTest.dcHttpClient.removePipeline = (plId, id, trusted) => {
        assert.equal(plId, pipelineId)
        called = true
      }
      subjectUnderTest.dcHttpClient.downloadPipelines = sinon.stub().resolves({ pipelines: [{ pipeline: { id: 'testPipeline' } }] })

      const file = path.join(subjectUnderTest.pipelinesFolder, 'dCPlTest4.json')
      subjectUnderTest.pipelines[file] = { id: pipelineId }

      subjectUnderTest._pipelineRemoved(file).then(() => {
        assert.ok(called)
        done()
      }).catch(err => {
        assert.ifError(err)
      })
    })

    it('should work', async () => {
      subjectUnderTest.pushHooks = () => {}
      appSettings.loadAttachedExtensions = () => { return { testExtension: { path: '..' } } }
      subjectUnderTest._startSubProcess = () => {}
      let checkPermissionsCalled = false
      let validateExtensionConfigsCalled = false
      subjectUnderTest.dcHttpClient.checkPermissions = () => { checkPermissionsCalled = true }
      subjectUnderTest.validateExtensionConfigs = () => { validateExtensionConfigsCalled = true }
      try {
        subjectUnderTest.writeExtensionConfigs = () => {}
        await subjectUnderTest.run({})
        assert.ok(checkPermissionsCalled, 'checkPermissions was not called')
        assert.ok(validateExtensionConfigsCalled, 'validateExtensionConfigs was not called')
      } catch (err) {
        assert.ifError(err)
      }
    })

    it('should write the extension configs for the app', async () => {
      subjectUnderTest.appSettings.EXTENSIONS_FOLDER = 'extensions'
      subjectUnderTest.dcHttpClient.checkPermissions = async () => { return true }
      const extensionConfigPath = path.join(
        subjectUnderTest.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER,
        'test-extension',
        'extension-config.json'
      )

      fsEx.createFileSync(extensionConfigPath)
      let mockConf = { someKey: 'someVal' }
      await fsEx.writeJson(extensionConfigPath, mockConf)
      let called = 0
      subjectUnderTest.appSettings.getId = () => 1
      subjectUnderTest.writeExtensionConfigs = () => {
        called++
        return Promise.resolve()
      }

      appSettings.loadAttachedExtensions = () => { return { testExtension: { path: 'test-extension' } } }
      subjectUnderTest.validateExtensionConfigs = () => { return true }
      subjectUnderTest._startSubProcess = () => {}
      let checkPermissionsCalled = false
      let validateExtensionConfigsCalled = false
      subjectUnderTest.dcHttpClient.checkPermissions = () => { checkPermissionsCalled = true }
      subjectUnderTest.validateExtensionConfigs = () => { validateExtensionConfigsCalled = true }

      await subjectUnderTest.run({})
      assert.ok(called !== 0, 'dcClient generateExtensionConfig should have been called at least once')
      assert.ok(checkPermissionsCalled, 'checkPermissions was not called')
      assert.ok(validateExtensionConfigsCalled, 'validateExtensionConfigs was not called')
    })

    it('should pass true to StepExecutor\'s "inspect" constructor argument when called with --inspect', async () => {
      subjectUnderTest.writeExtensionConfigs = () => {}
      subjectUnderTest.pushHooks = () => {}
      subjectUnderTest._startSubProcess = async function () {
        if (this.backendProcess.executor.inspect !== true) throw new Error('Expected third constructor argument "inspect" to true.')
      }

      let checkPermissionsCalled = false
      let validateExtensionConfigsCalled = false
      subjectUnderTest.dcHttpClient.checkPermissions = () => { checkPermissionsCalled = true }
      subjectUnderTest.validateExtensionConfigs = () => { validateExtensionConfigsCalled = true }

      await subjectUnderTest.run({ inspect: true })
      assert.ok(checkPermissionsCalled, 'checkPermissions was not called')
      assert.ok(validateExtensionConfigsCalled, 'validateExtensionConfigs was not called')
    })

    it('should pass false to StepExecutor\'s "inspect" constructor argument when called without --inspect', async () => {
      subjectUnderTest.pushHooks = () => {}
      subjectUnderTest._startSubProcess = async function () {
        if (this.backendProcess.executor.inspect !== false) throw new Error('Expected third constructor argument "inspect" to false.')
      }

      let checkPermissionsCalled = false
      let validateExtensionConfigsCalled = false
      subjectUnderTest.dcHttpClient.checkPermissions = () => { checkPermissionsCalled = true }
      subjectUnderTest.validateExtensionConfigs = () => { validateExtensionConfigsCalled = true }

      await subjectUnderTest.run({})
      assert.ok(checkPermissionsCalled, 'checkPermissions was not called')
      assert.ok(validateExtensionConfigsCalled, 'validateExtensionConfigs was not called')
    })

    it('should hand the loaded encryption keys to the StepExecutor', async () => {
      const keys = [{ alias: 'PARTNER_A', publicKeyPem: 'pem' }]
      subjectUnderTest.dcHttpClient.getEncryptionKeys = sinon.stub().resolves(keys)
      subjectUnderTest.writeExtensionConfigs = () => {}
      subjectUnderTest.pushHooks = () => {}
      subjectUnderTest.dcHttpClient.checkPermissions = () => {}
      subjectUnderTest.validateExtensionConfigs = () => {}

      let passedEncryptionKeys
      subjectUnderTest._startSubProcess = async function () {
        passedEncryptionKeys = this.backendProcess.executor.encryptionKeys
      }

      await subjectUnderTest.run({})

      assert.deepEqual(passedEncryptionKeys, { keys, unavailableReason: '' })
    })
  })

  describe('loadEncryptionKeys', () => {
    it('should return the keys of the application', async () => {
      const keys = [{ alias: 'PARTNER_A', publicKeyPem: 'pem' }]
      subjectUnderTest.dcHttpClient.getEncryptionKeys = sinon.stub().resolves(keys)

      assert.deepEqual(await subjectUnderTest.loadEncryptionKeys(), { keys, unavailableReason: '' })
      assert.ok(subjectUnderTest.dcHttpClient.getEncryptionKeys.calledWith('foobarTest'))
    })

    it('should log the aliases of the available keys', async () => {
      const infos = []
      info = (message) => infos.push(message)
      subjectUnderTest.dcHttpClient.getEncryptionKeys = sinon.stub().resolves([
        { alias: 'PARTNER_A', publicKeyPem: 'pem' },
        { alias: 'PARTNER_B', publicKeyPem: 'pem' }
      ])

      await subjectUnderTest.loadEncryptionKeys()

      assert.ok(
        infos.some(message => /context\.encrypt: PARTNER_A, PARTNER_B$/.test(message)),
        `expected the key aliases to be logged, got: ${JSON.stringify(infos)}`
      )
    })

    it('should log that the application has no keys configured', async () => {
      const infos = []
      info = (message) => infos.push(message)
      subjectUnderTest.dcHttpClient.getEncryptionKeys = sinon.stub().resolves([])

      await subjectUnderTest.loadEncryptionKeys()

      assert.ok(
        infos.some(message => /No encryption keys are configured/.test(message)),
        `expected a message about missing keys, got: ${JSON.stringify(infos)}`
      )
    })

    it('should report an outdated pipeline controller instead of failing', async () => {
      const warnings = []
      warn = (message) => warnings.push(message)
      subjectUnderTest.dcHttpClient.getEncryptionKeys = sinon.stub().rejects(new NotFoundError('nope'))

      assert.deepEqual(
        await subjectUnderTest.loadEncryptionKeys(),
        { keys: [], unavailableReason: UNAVAILABLE_UNSUPPORTED }
      )
      assert.ok(warnings.some(warning => /does not provide encryption keys/.test(warning)))
    })

    it('should fall back to a generic reason on any other failure', async () => {
      const warnings = []
      warn = (message) => warnings.push(message)
      subjectUnderTest.dcHttpClient.getEncryptionKeys = sinon.stub().rejects(new Error('boom'))

      assert.deepEqual(
        await subjectUnderTest.loadEncryptionKeys(),
        { keys: [], unavailableReason: UNAVAILABLE_FAILED }
      )
      assert.ok(warnings.some(warning => /Could not load encryption keys/.test(warning)))
    })
  })
})
