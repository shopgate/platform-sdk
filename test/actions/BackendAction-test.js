const assert = require('assert')
const sinon = require('sinon')
const path = require('path')
const fsEx = require('fs-extra')
const proxyquire = require('proxyquire')

const utils = require('../../lib/utils/utils')

const AppSettings = require('../../lib/app/AppSettings')
const UserSettings = require('../../lib/user/UserSettings')
const DcHttpClient = require('../../lib/DcHttpClient')
const userSettingsFolder = path.join('build', 'usersettings')
const appPath = path.join('build', 'appsettings')

describe('BackendAction', () => {
  /**
   * @type {BackendAction}
   */
  let subjectUnderTest
  let logger = {}
  const BackendAction = proxyquire('../../lib/actions/BackendAction', {
    '../logger': logger
  })

  let appSettings
  let userSettings
  let dcHttpClient

  before(async () => {
    process.env.USER_PATH = userSettingsFolder
    await fsEx.emptyDir(userSettingsFolder)
    await fsEx.emptyDir(path.join(appPath, AppSettings.SETTINGS_FOLDER))
  })

  beforeEach(async () => {
    process.env.USER_PATH = userSettingsFolder

    await fsEx.emptyDir(userSettingsFolder)
    await fsEx.emptyDir(path.join(appPath, AppSettings.SETTINGS_FOLDER))

    appSettings = await new AppSettings(appPath).setId('foobarTest')
    appSettings.loadAttachedExtensions = sinon.stub().resolves()
    userSettings = await new UserSettings().setToken({})
    dcHttpClient = new DcHttpClient(userSettings, null)

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

    logger.info = () => {}
    logger.error = () => {}
    logger.debug = () => {}
  })

  afterEach(async () => {
    await subjectUnderTest.pipelineWatcher.close()
    await subjectUnderTest.extensionConfigWatcher.stop()
  })

  after(async () => {
    await fsEx.remove(userSettingsFolder)
    await fsEx.remove(appPath)
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
        assert.equal(err.message, 'You\'re not logged in! Please run `sgcloud login` again.')
      }
    })

    it('should fail because a backend process is already running', (done) => {
      const pid = process.pid
      const processFile = path.join(appPath, AppSettings.SETTINGS_FOLDER)

      utils.setProcessFile('backend', processFile, pid)

      subjectUnderTest.run()
        .catch(err => {
          assert.equal(err.message, `Backend process is already running with pid: ${pid}. Please quit this process first.`)
          done()
        })
    })
  })

  describe('_pipelineEvent', () => {
    it('should not do anything when the extension is not attached', (done) => {
      subjectUnderTest._pipelineRemoved = sinon.stub().resolves()
      subjectUnderTest._pipelineChanged = sinon.stub().resolves()

      logger.debug = (msg) => {
        assert.equal(msg, 'The extension of the pipeline is not attached --> skip')
        assert.ok(!subjectUnderTest._pipelineRemoved.called, '_pipelineRemoved should not be called')
        assert.ok(!subjectUnderTest._pipelineChanged.called, '_pipelineChanged should not be called')
        done()
      }
      subjectUnderTest._pipelineEvent('test', 'somefile')
    })
  })

  describe('watching', () => {
    it('should update pipelines', (done) => {
      subjectUnderTest.backendProcess = {
        connect: sinon.stub().resolves(),
        selectApplication: sinon.stub().resolves(),
        resetPipelines: sinon.stub().resolves(),
        startStepExecutor: sinon.stub().resolves(),
        reloadPipelineController: sinon.stub().resolves()
      }

      subjectUnderTest.dcHttpClient = {
        downloadPipelines: sinon.stub().resolves([{pipeline: {id: 'testPipeline'}}]),
        removePipeline: sinon.stub().resolves(),
        uploadMultiplePipelines: sinon.stub().resolves()
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
          assert.deepEqual(content, {pipeline: {id: 'testPipeline'}})
          done()
        })
    })

    it('should fail when pipeline IDs not matching pipeline file names', (done) => {
      appSettings.loadAttachedExtensions = () => { return {testExtension: {path: '..'}} }

      subjectUnderTest.backendProcess = {
        connect: sinon.stub().resolves(),
        selectApplication: sinon.stub().resolves(),
        resetPipelines: sinon.stub().resolves(),
        startStepExecutor: sinon.stub().resolves(),
        reloadPipelineController: sinon.stub().resolves()
      }

      subjectUnderTest.dcHttpClient = {
        downloadPipelines: sinon.stub().resolves([]),
        removePipeline: sinon.stub().resolves(),
        uploadMultiplePipelines: sinon.stub().resolves()
      }

      subjectUnderTest.attachedExtensionsWatcher = {
        attachedExtensions: [{'testPipeline123': {path: ''}}],
        start: () => sinon.stub().resolves(),
        on: () => sinon.stub().resolves()
      }

      subjectUnderTest._updateExtensionConfig = sinon.stub().resolves()

      fsEx.writeJson(path.join(appPath, 'pipelines', 'testPipeline.json'), {pipeline: {id: 'testPipeline123'}}, err => {
        assert.ifError(err)

        subjectUnderTest._startSubProcess()
          .then(() => fsEx.readJson(path.join(appPath, 'pipelines', 'testPipeline.json')))
          .then((content) => {
            assert.deepEqual(content, {pipeline: {id: 'testPipeline123'}})
          })
          .catch(err => {
            assert.ok(err)
            assert.equal(
              err.message,
              'Pipeline ID "testPipeline123" and file name "testPipeline" mismatch! ' +
              'The ID of a pipeline and its file name should be the same.'
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

      const pipeline = {pipeline: {id: 'plFooBarline1'}}
      const appId = 'foobarAppIdDcTestBackendAction'
      await appSettings.setId(appId)

      const file = path.join(subjectUnderTest.pipelinesFolder, 'plFooBarline1.json')
      assert.equal(subjectUnderTest.pipelines[file], undefined)

      subjectUnderTest.dcHttpClient.uploadPipeline = (f, aId) => {
        assert.deepEqual(subjectUnderTest.pipelines[file].id, pipeline.pipeline.id)
        assert.deepEqual(f, pipeline)
        assert.equal(aId, appId)
      }

      await fsEx.writeJson(file, pipeline)
      await subjectUnderTest._pipelineChanged(file)
    })

    it('should write generated extension-config if backend-extension was updated', async () => {
      let generated = {backend: {id: 'myGeneratedExtension'}}

      let called = 0
      subjectUnderTest.dcHttpClient.generateExtensionConfig = () => {
        called++
        return Promise.resolve(generated)
      }

      const cfgPath = path.join(appPath, 'extensions', 'testExt')

      try {
        await subjectUnderTest._updateExtensionConfig({file: generated, path: cfgPath})
        const content = await fsEx.readJson(path.join(cfgPath, 'extension', 'config.json'))
        assert.deepEqual(content, {id: 'myGeneratedExtension'})
        assert.equal(called, 1)
      } catch (err) {
        assert.ifError(err)
      }
    })

    it('should write generated extension-config if frontend-extension was updated', async () => {
      let generated = {frontend: {id: 'myGeneratedExtension'}}

      let called = 0
      subjectUnderTest.dcHttpClient.generateExtensionConfig = () => {
        called++
        return Promise.resolve(generated)
      }

      const cfgPath = path.join(appPath, 'extension', 'testExt')

      try {
        await subjectUnderTest._updateExtensionConfig({file: generated, path: cfgPath})
        const content = await fsEx.readJson(path.join(cfgPath, 'frontend', 'config.json'))
        assert.deepEqual(content, {id: 'myGeneratedExtension'})
        assert.equal(called, 1)
      } catch (err) {
        assert.ifError(err)
      }
    })

    it('should throw error if dcClient is not reachable', (done) => {
      const pipeline = {pipeline: {id: 'dCPlTest2'}}
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
      const pipeline = {pipeline: {id: 'dCPlTest3'}}
      const file = path.join(subjectUnderTest.pipelinesFolder, 'dCPlTest3.json')

      subjectUnderTest.dcHttpClient = {
        uploadPipeline: sinon.stub().resolves()
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
      const pipeline = {pipeline: {id: 'nonMatchingId'}}

      const file = path.join(subjectUnderTest.pipelinesFolder, 'dCPlTest3.json')
      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        subjectUnderTest._pipelineChanged(file).catch(err => {
          assert.ok(err)
          assert.equal(err.message, `Pipeline ID "${pipeline.pipeline.id}" should match its file name!`)
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
          assert.equal(err.message, `invalid pipeline; check the pipeline.id property in ${file}`)
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
      subjectUnderTest._writeLocalPipelines = sinon.mock().resolves()
      subjectUnderTest.dcHttpClient.removePipeline = (plId, id, trusted) => {
        assert.equal(plId, pipelineId)
        called = true
      }

      const file = path.join(subjectUnderTest.pipelinesFolder, 'dCPlTest4.json')
      subjectUnderTest.pipelines[file] = {id: pipelineId}

      subjectUnderTest._pipelineRemoved(file).then(() => {
        assert.ok(called)
        assert.ok(subjectUnderTest._writeLocalPipelines.called)
        done()
      }).catch(err => {
        assert.ifError(err)
      })
    })

    it('should work', async () => {
      appSettings.loadAttachedExtensions = () => { return {testExtension: {path: '..'}} }
      subjectUnderTest._startSubProcess = () => {}
      try {
        subjectUnderTest.writeExtensionConfigs = () => {}
        await subjectUnderTest.run({})
      } catch (err) {
        assert.ifError(err)
      }
    })

    it('should write the extension configs for the app', async () => {
      subjectUnderTest.appSettings.EXTENSIONS_FOLDER = 'extensions'
      const extensionConfigPath = path.join(
        subjectUnderTest.appSettings.getApplicationFolder(), AppSettings.EXTENSIONS_FOLDER,
        'test-extension',
        'extension-config.json'
      )

      fsEx.createFileSync(extensionConfigPath)
      let mockConf = {someKey: 'someVal'}
      await fsEx.writeJson(extensionConfigPath, mockConf)
      let called = 0
      subjectUnderTest.appSettings.getId = () => 1
      subjectUnderTest.dcHttpClient.generateExtensionConfig = (config) => {
        called++
        return Promise.resolve(config)
      }

      appSettings.loadAttachedExtensions = () => { return {testExtension: {path: 'test-extension'}} }
      subjectUnderTest._startSubProcess = () => {}

      await subjectUnderTest.run({})
      assert.ok(called !== 0, 'dcClient generateExtensionConfig should have been called at least once')
    })

    it('should pass true to StepExecutor\'s "inspect" constructor argument when called with --inspect', async () => {
      subjectUnderTest.writeExtensionConfigs = () => {}
      subjectUnderTest._startSubProcess = async function () {
        if (this.backendProcess.executor.inspect !== true) throw new Error('Expected third constructor argument "inspect" to true.')
      }

      await subjectUnderTest.run({inspect: true})
    })

    it('should pass false to StepExecutor\'s "inspect" constructor argument when called without --inspect', async () => {
      subjectUnderTest._startSubProcess = async function () {
        if (this.backendProcess.executor.inspect !== false) throw new Error('Expected third constructor argument "inspect" to false.')
      }

      await subjectUnderTest.run({})
    })
  })
})
