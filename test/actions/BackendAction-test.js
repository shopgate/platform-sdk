const assert = require('assert')
const sinon = require('sinon')
const path = require('path')
const fsEx = require('fs-extra')
const proxyquire = require('proxyquire')

const utils = require('../../lib/utils/utils')

const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')
const userSettingsFolder = path.join('build', 'usersettings')
const appPath = path.join('build', 'appsettings')

describe('BackendAction', () => {
  /**
   * @type {BackendAction}
   */
  let backendAction
  let logger = {}
  const BackendAction = proxyquire('../../lib/actions/BackendAction', {
    '../logger': logger
  })

  let userSettings
  let appSettings

  before(() => {
    process.env.USER_PATH = userSettingsFolder
    process.env.APP_PATH = appPath
    fsEx.emptyDir(userSettingsFolder)
      .then(() => fsEx.emptyDir(path.join(appPath, AppSettings.SETTINGS_FOLDER)))
  })

  beforeEach(function () {
    process.env.USER_PATH = userSettingsFolder

    return fsEx.emptyDir(userSettingsFolder)
      .then(() => fsEx.emptyDir(path.join(appPath, AppSettings.SETTINGS_FOLDER)))
      .then(() => {
        userSettings = new UserSettings().setToken({})
        appSettings = new AppSettings().setId('foobarTest')

        backendAction = new BackendAction()

        backendAction.userSettings = userSettings
        backendAction.appSettings = appSettings
      })
      .then(() => fsEx.emptyDir(backendAction.pipelinesFolder))
      .then(() => {
        backendAction.pipelineWatcher = {
          start: sinon.stub().resolves(),
          close: () => {},
          on: (event, fn) => fn(event, path.join(backendAction.pipelinesFolder, 'testPipeline.json'))
        }
        backendAction.extensionConfigWatcher = {
          start: () => sinon.stub().resolves(),
          on: () => sinon.stub().resolves(),
          stop: () => sinon.stub().resolves()
        }

        backendAction.cliProxy = {
          start: () => sinon.stub().resolves(),
          close: () => sinon.stub().resolves()
        }

        backendAction.attachedExtensionsWatcher = {
          attachedExtensions: []
        }

        backendAction.dcClient = {}

        logger.info = () => {}
        logger.error = () => {}
        logger.debug = () => {}
      })
  })

  afterEach(async () => {
    backendAction.pipelineWatcher.close()
    return backendAction.extensionConfigWatcher.stop()
  })

  after(() => {
    return fsEx.remove(userSettingsFolder)
      .then(() => fsEx.remove(appPath))
  })

  describe('general', () => {
    it('should register', () => {
      const caporal = {}
      caporal.command = sinon.stub().returns(caporal)
      caporal.description = sinon.stub().returns(caporal)
      caporal.action = sinon.stub().returns(caporal)

      BackendAction.register(caporal)

      assert(caporal.command.calledWith('backend start'))
      assert(caporal.description.calledOnce)
      assert(caporal.action.calledOnce)
    })

    it('should throw if user not logged in', () => {
      userSettings.setToken()
      try {
        backendAction.run('start')
      } catch (err) {
        assert.equal(err.message, 'You\'re not logged in! Please run `sgcloud login` again.')
      }
    })

    it('should fail because a backend process is already running', (done) => {
      const pid = process.pid
      const processFile = path.join(appPath, AppSettings.SETTINGS_FOLDER)

      utils.setProcessFile('backend', processFile, pid)

      try {
        backendAction.run('start')
      } catch (err) {
        assert.equal(err.message, `Backend process is already running with pid: ${pid}. Please quit this process first.`)
        done()
      }
    })
  })

  describe('_pipelineEvent', () => {
    it('should not do anything when the extension is not attached', (done) => {
      backendAction._pipelineRemoved = sinon.stub().resolves()
      backendAction._pipelineChanged = sinon.stub().resolves()

      logger.debug = (msg) => {
        assert.equal(msg, 'The extension of the pipeline is not attached --> skip')
        assert.ok(!backendAction._pipelineRemoved.called, '_pipelineRemoved should not be called')
        assert.ok(!backendAction._pipelineChanged.called, '_pipelineChanged should not be called')
        done()
      }
      backendAction._pipelineEvent('test', 'somefile')
    })
  })

  describe('watching', () => {
    it('should update pipelines', (done) => {
      backendAction.backendProcess = {
        connect: sinon.stub().resolves(),
        selectApplication: sinon.stub().resolves(),
        resetPipelines: sinon.stub().resolves(),
        startStepExecutor: sinon.stub().resolves(),
        reloadPipelineController: sinon.stub().resolves()
      }

      backendAction.dcClient = {
        downloadPipelines: sinon.stub().resolves([{pipeline: {id: 'testPipeline'}}]),
        removePipeline: sinon.stub().resolves(),
        uploadMultiplePipelines: sinon.stub().resolves()
      }

      backendAction.attachedExtensionsWatcher = {
        attachedExtensions: [],
        start: () => sinon.stub().resolves(),
        on: () => sinon.stub().resolves()
      }

      backendAction._extensionChanged = sinon.stub().resolves()

      backendAction._startSubProcess()
        .then(() => fsEx.readJson(path.join(process.env.APP_PATH, 'pipelines', 'testPipeline.json')))
        .then((content) => {
          assert.deepEqual(content, {pipeline: {id: 'testPipeline'}})
          done()
        })
    })

    it('should fail when pipeline IDs not matching pipeline file names', (done) => {
      appSettings.loadAttachedExtensions = () => { return {testExtension: {path: '..'}} }

      backendAction.backendProcess = {
        connect: sinon.stub().resolves(),
        selectApplication: sinon.stub().resolves(),
        resetPipelines: sinon.stub().resolves(),
        startStepExecutor: sinon.stub().resolves(),
        reloadPipelineController: sinon.stub().resolves()
      }

      backendAction.dcClient = {
        downloadPipelines: sinon.stub().resolves([]),
        removePipeline: sinon.stub().resolves(),
        uploadMultiplePipelines: sinon.stub().resolves()
      }

      backendAction.attachedExtensionsWatcher = {
        attachedExtensions: [{'testPipeline123': {path: ''}}],
        start: () => sinon.stub().resolves(),
        on: () => sinon.stub().resolves()
      }

      backendAction._extensionChanged = sinon.stub().resolves()

      fsEx.writeJson(path.join(process.env.APP_PATH, 'pipelines', 'testPipeline.json'), {pipeline: {id: 'testPipeline123'}}, err => {
        assert.ifError(err)

        backendAction._startSubProcess()
          .then(() => fsEx.readJson(path.join(process.env.APP_PATH, 'pipelines', 'testPipeline.json')))
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

    it('should call dcClient if pipelines were updated', (done) => {
      backendAction.backendProcess = {
        connect: sinon.stub().resolves(),
        selectApplication: sinon.stub().resolves(),
        resetPipelines: sinon.stub().resolves(),
        startStepExecutor: sinon.stub().resolves(),
        reloadPipelineController: sinon.stub().resolves()
      }

      const pipeline = {pipeline: {id: 'plFooBarline1'}}
      const appId = 'foobarAppIdDcTestBackendAction'
      appSettings.setId(appId)

      const file = path.join(backendAction.pipelinesFolder, 'plFooBarline1.json')
      assert.equal(backendAction.pipelines[file], undefined)

      backendAction.dcClient.uploadPipeline = (f, aId, trusted) => {
        assert.deepEqual(backendAction.pipelines[file].id, pipeline.pipeline.id)
        assert.deepEqual(f, pipeline)
        assert.equal(aId, appId)
      }

      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file).then(() => {
          done()
        })
      })
    })

    it('should write generated extension-config if backend-extension was updated', async () => {
      let generated = {backend: {id: 'myGeneratedExtension'}}
      backendAction.dcClient.generateExtensionConfig = () => new Promise().resolve(generated)

      const cfgPath = path.join(process.env.APP_PATH, 'extensions', 'testExt')

      try {
        await backendAction._extensionChanged({file: generated, path: cfgPath})
        const content = await fsEx.readJson(path.join(cfgPath, 'extension', 'config.json'))
        assert.deepEqual(content, {id: 'myGeneratedExtension'})
      } catch (err) {
        assert.ifError(err)
      }
    })

    it('should write generated extension-config if frontend-extension was updated', (done) => {
      let generated = {frontend: {id: 'myGeneratedExtension'}}
      backendAction.dcClient.generateExtensionConfig = (config, appId, cb) => cb(null, generated)

      const cfgPath = path.join(process.env.APP_PATH, 'extension', 'testExt')

      backendAction._extensionChanged({file: generated, path: cfgPath}, (err) => {
        assert.ifError(err)
        fsEx.readJson(path.join(cfgPath, 'frontend', 'config.json'))
          .then(cfg => {
            assert.deepEqual(cfg, {id: 'myGeneratedExtension'})
            done()
          })
      })
    })

    it('should throw error if dcClient is not reachable', (done) => {
      const pipeline = {pipeline: {id: 'dCPlTest2'}}
      backendAction.dcClient = {
        uploadPipeline: sinon.stub().rejects(new Error('error'))
      }

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest2.json')
      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file).catch(err => {
          assert.ok(err)
          assert.equal(err.message, `error`)
          done()
        })
      })
    })

    it('should return if pipeline was changed', (done) => {
      const pipeline = {pipeline: {id: 'dCPlTest3'}}
      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest3.json')

      backendAction.dcClient = {
        uploadPipeline: sinon.stub().resolves()
      }

      backendAction.backendProcess = {
        connect: sinon.stub().resolves(),
        selectApplication: sinon.stub().resolves(),
        resetPipelines: sinon.stub().resolves(),
        startStepExecutor: sinon.stub().resolves(),
        reloadPipelineController: sinon.stub().resolves()
      }

      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file).then(err => {
          assert.ifError(err)
          done()
        })
      })
    })

    it('should throw an error if pipeline id is not matching with the filename', (done) => {
      const pipeline = {pipeline: {id: 'nonMatchingId'}}

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest3.json')
      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file).catch(err => {
          assert.ok(err)
          assert.equal(err.message, `Pipeline ID "${pipeline.pipeline.id}" should match its file name!`)
          done()
        })
      })
    })

    it('should throw an error if pipeline is invalid', (done) => {
      const pipeline = {}
      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest3.json')

      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file).catch(err => {
          assert.ok(err)
          assert.equal(err.message, `invalid pipeline; check the pipeline.id property in ${file}`)
          done()
        })
      })
    })

    it('should throw an error if pipeline has invalid json', (done) => {
      const pipeline = '{someInvalid: content}'
      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest5.json')

      fsEx.writeFile(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file).catch(err => {
          assert.ok(err)
          assert.equal(err.message, 'Parse error on line 1:\n{someInvalid: content\n-^\nExpecting \'STRING\', \'}\', got \'undefined\'')
          done()
        })
      })
    })

    it('should return if pipeline was removed', (done) => {
      const pipelineId = 'dCPlTest4'
      let called = false
      backendAction._writeLocalPipelines = sinon.mock().resolves()
      backendAction.dcClient.removePipeline = (plId, id, trusted) => {
        assert.equal(plId, pipelineId)
        called = true
      }

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest4.json')
      backendAction.pipelines[file] = {id: pipelineId}

      backendAction._pipelineRemoved(file).then(() => {
        assert.ok(called)
        assert.ok(backendAction._writeLocalPipelines.called)
        done()
      }).catch(err => {
        assert.ifError(err)
      })
    })

    it('should work', () => {
      backendAction._startSubProcess = () => {}
      try {
        backendAction.run('start')
      } catch (err) {
        assert.ifError(err)
      }
    })
  })
})
