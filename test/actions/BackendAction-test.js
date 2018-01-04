const assert = require('assert')
const sinon = require('sinon')
const path = require('path')
const os = require('os')
const fsEx = require('fs-extra')
const proxyquire = require('proxyquire')

const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')
const userSettingsFolder = path.join('build', 'usersettings')
const appPath = path.join('build', 'appsettings')

const callbacks = {
  connect: (cb) => cb(),
  selectApplication: (id, cb) => cb()
}

class BackendProcess {
  connect (cb) {
    process.nextTick(() => callbacks.connect(cb))
  }

  selectApplication (id, cb) {
    process.nextTick(() => callbacks.selectApplication(id, cb))
  }

  triggerPipelineReload (cb) {
    cb()
  }
}

let logger = {
  info: () => {},
  error: () => {},
  debug: () => {}
}

let utils = {
  previousProcess: () => { return 1 },
  setProcessFile: () => {},
  deleteProcessFile: () => {}
}

describe('BackendAction', () => {
  let backendAction
  const BackendAction = proxyquire('../../lib/actions/BackendAction', {
    '../app/backend/BackendProcess': BackendProcess,
    '../logger': logger,
    '../utils/utils': utils
  })

  beforeEach(function (done) {
    logger.info = () => {}
    logger.error = () => {}
    logger.debug = () => {}

    utils.previousProcess = () => { return null }
    utils.setProcessFile = () => {}
    utils.deleteProcessFile = () => {}

    fsEx.emptyDirSync(userSettingsFolder)
    process.env.USER_PATH = userSettingsFolder
    UserSettings.getInstance().getSession().token = {}

    process.env.APP_PATH = appPath
    const appSettings = new AppSettings()
    fsEx.emptyDirSync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    appSettings.setId('foobarTest').setAttachedExtensions({}).save()

    appSettings.init()
    AppSettings.setInstance(appSettings)

    backendAction = new BackendAction()
    fsEx.emptyDirSync(backendAction.pipelinesFolder)
    backendAction.pipelineWatcher = {
      start: (cb) => cb(),
      close: () => {},
      on: (event, fn) => {}
    }
    backendAction.extensionConfigWatcher = {
      start: (cb) => cb(),
      stop: () => {},
      on: (event, fn) => {}
    }

    backendAction.cliProxy = {
      start: (cb) => cb(),
      close: (cb) => cb()
    }

    backendAction.dcClient = {}
    backendAction.backendProcess = new BackendProcess()
    backendAction.backendProcess.attachedExtensionsWatcher = { stop: (cb) => cb() }

    done()
  })

  afterEach(function () {
    UserSettings.setInstance()
    AppSettings.setInstance()
    delete process.env.USER_PATH
    delete process.env.APP_PATH
  })

  describe('general', () => {
    it('should work', () => {
      backendAction._startSubProcess = () => {}
      assert.doesNotThrow(() => backendAction.run('start'))
    })

    it('should register', () => {
      const commander = {}
      commander.command = sinon.stub().returns(commander)
      commander.description = sinon.stub().returns(commander)
      commander.action = sinon.stub().returns(commander)

      backendAction.register(commander)

      assert(commander.command.calledWith('backend <action>'))
      assert(commander.description.calledOnce)
      assert(commander.action.calledOnce)
    })

    it('should throw if user not logged in', (done) => {
      UserSettings.getInstance().getSession().token = null
      try {
        backendAction.run('attach')
      } catch (err) {
        assert.equal(err.message, "You're not logged in! Please run `sgcloud login` again.")
        done()
      }
    })

    it('should throw if invalid action is given', (done) => {
      try {
        backendAction.run('invalid')
      } catch (err) {
        assert.equal(err.message, 'unknown action "invalid"')
        done()
      }
    })

    it('should fail because a backend process is already running', (done) => {
      const pid = 1
      utils.previousProcess = () => { return pid }
      backendAction._startSubProcess = () => {
        assert.fail('_startSubProcess should not be called')
      }

      try {
        backendAction.run('start')
      } catch (err) {
        assert.equal(err.message, `Backend process is already running with pid: ${pid}. Please quit this process first.`)
        done()
      }
    })
  })

  describe('_closeAllComponents', () => {
    it('should close all components and remove the process file', (done) => {
      backendAction.pipelineWatcher.close = sinon.stub()
      backendAction.extensionConfigWatcher.stop = sinon.stub().callsArg(0)
      backendAction.backendProcess.attachedExtensionsWatcher.stop = sinon.stub().callsArg(0)
      backendAction.backendProcess.disconnect = sinon.stub().callsArg(0)
      backendAction.cliProxy.close = sinon.stub().callsArg(0)
      utils.deleteProcessFile = sinon.stub()

      backendAction._closeAllComponents(() => {
        assert.ok(backendAction.pipelineWatcher.close.called)
        assert.ok(backendAction.extensionConfigWatcher.stop.called)
        assert.ok(backendAction.backendProcess.attachedExtensionsWatcher.stop.called)
        assert.ok(backendAction.backendProcess.disconnect.called)
        assert.ok(backendAction.cliProxy.close.called)
        assert.ok(utils.deleteProcessFile.calledWith('backend', backendAction.settingsFolder))
        done()
      })
    })
  })

  describe('_pipelineEvent', () => {
    it('should detect that pipelines was changed', (done) => {
      const pipeline = {pipeline: {id: 'BAPipelineEventTest1'}}
      const file = path.join(backendAction.pipelinesFolder, 'BAPipelineTest1.json')

      backendAction._pipelineRemoved = () => { assert.fail('The _pipelineRemoved should not get called') }
      backendAction._pipelineChanged = (actualFile, cb) => {
        assert.equal(actualFile, file)
        cb()
      }

      logger.info = (msg) => {
        assert.equal(msg, `Updated pipeline '${file}'`)
        done()
      }

      fsEx.writeFileSync(file, pipeline)
      backendAction._pipelineEvent(null, file)
    })

    it('should detect that pipelines was removed', (done) => {
      const file = path.join(backendAction.pipelinesFolder, 'BAPipelineTest1.json')

      backendAction._pipelineRemoved = (actualFile, cb) => {
        assert.equal(actualFile, file)
        done()
      }

      backendAction._pipelineChanged = (actualFile, cb) => {
        assert.fail('The _pipelineRemoved should not get called')
      }

      backendAction._pipelineEvent(null, file)
    })

    it('should show an error if pipeline is invalid', (done) => {
      const pipeline = {pipeline: {id: 'BAPipelineEventTest1'}}
      const file = path.join(backendAction.pipelinesFolder, 'BAPipelineTest1.json')

      backendAction._pipelineRemoved = () => { assert.fail('The _pipelineRemoved should not get called') }
      backendAction._pipelineChanged = (actualFile, cb) => {
        assert.equal(actualFile, file)
        const error = new Error()
        error.code = 'PIPELINE_INVALID'
        error.message = JSON.stringify({errors: [{message: 'Something is wrong', fiels: 'somefield'}]})
        cb(error)
      }

      logger.error = (obj, msg) => {
        assert.equal(msg, `Pipeline invalid: Something is wrong`)
        done()
      }

      fsEx.writeFileSync(file, pipeline)
      backendAction._pipelineEvent(null, file)
    })

    it('should show an error if a step was not found', (done) => {
      const pipeline = {pipeline: {id: 'BAPipelineEventTest1'}}
      const file = path.join(backendAction.pipelinesFolder, 'BAPipelineTest1.json')

      backendAction._pipelineRemoved = () => { assert.fail('The _pipelineRemoved should not get called') }
      backendAction._pipelineChanged = (actualFile, cb) => {
        assert.equal(actualFile, file)
        const error = new Error()
        error.code = 'STEP_NOT_FOUND'
        cb(error)
      }

      logger.info = (msg) => {
        assert.equal(msg, 'Check if the extension containing this step is attached')
        done()
      }

      fsEx.writeFileSync(file, pipeline)
      backendAction._pipelineEvent(null, file)
    })
  })

  describe('_pipelineChanged', () => {
    it('should read the pipeline, upload it and reload the PLC', (done) => {
      const pipeline = {pipeline: {id: 'BAPipelineTest1'}}
      let calledUploadPipeline = false

      backendAction._uploadPipeline = (actualPipeline, isTrusted, cb) => {
        assert.ok(!isTrusted)
        assert.deepEqual(actualPipeline, pipeline)
        calledUploadPipeline = true
        cb()
      }

      backendAction.backendProcess.triggerPipelineReload = (cb) => {
        assert.ok(calledUploadPipeline, 'Pipelines was not uploaded before reloading')
        cb()
      }

      const file = path.join(backendAction.pipelinesFolder, 'BAPipelineTest1.json')
      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file, done)
      })
    })

    it('should throw error if dcClient is not reachable', (done) => {
      const pipeline = {pipeline: {id: 'dCPlTest2'}}
      backendAction._uploadPipeline = (pl, trusted, cb) => cb(new Error('error'))

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest2.json')
      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file, (err) => {
          assert.ok(err)
          assert.equal(err.message, `error`)
          done()
        })
      })
    })

    it('should throw an error if pipeline id is not matching with the filename', (done) => {
      const pipeline = {pipeline: {id: 'nonMatchingId'}}
      backendAction.dcClient.uploadPipeline = (pl, id, trusted, cb) => cb()

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest3.json')
      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file, (err) => {
          assert.ok(err)
          assert.equal(err.message, 'The pipeline id and the file name need to be equal! Please make sure you changed both places')
          done()
        })
      })
    })

    it('should throw an error if pipeline is invalid', (done) => {
      const pipeline = {}
      backendAction.dcClient.uploadPipeline = (pl, id, trusted, cb) => cb()

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest3.json')
      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file, (err) => {
          assert.ok(err)
          assert.equal(err.message, `invalid pipeline; check the pipeline.id property in ${file}`)
          done()
        })
      })
    })

    it('should throw an error if pipeline has invalid json', (done) => {
      const pipeline = '{someInvalid: content}'
      backendAction.dcClient.uploadPipeline = (pl, id, trusted, cb) => cb()

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest5.json')
      fsEx.writeFile(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file, (err) => {
          assert.ok(err)
          assert.equal(err.message, 'Parse error on line 1:\n{someInvalid: content\n-^\nExpecting \'STRING\', \'}\', got \'undefined\'')
          done()
        })
      })
    })
  })

  describe('_uploadPipeline', () => {
    it('should upload the pipeline', (done) => {
      const pipeline = {pipeline: {id: 'BAPipelineTest1'}}
      const stub = sinon.stub()
      stub.callsArg(3)
      backendAction.dcClient.uploadPipeline = stub

      backendAction._uploadPipeline(pipeline, false, (err) => {
        assert.ifError(err)
        assert.equal(stub.callCount, 1)
        done()
      })
    })

    it('should retry 5 times after throwing an error', function (done) {
      this.timeout(4000)
      const pipeline = {pipeline: {id: 'BAPipelineTest1'}}
      const stub = sinon.stub()
      stub.callsArgWith(3, new Error('test'))
      backendAction.dcClient.uploadPipeline = stub

      backendAction._uploadPipeline(pipeline, false, (err) => {
        assert.equal(err.message, 'test')
        assert.equal(stub.callCount, 5)
        done()
      })
    })

    it('should not retry if the error has the status code 400', (done) => {
      const pipeline = {pipeline: {id: 'BAPipelineTest1'}}
      const stub = sinon.stub()
      const err = new Error('test')
      err.statusCode = 400
      stub.callsArgWith(3, err)
      backendAction.dcClient.uploadPipeline = stub

      backendAction._uploadPipeline(pipeline, false, (err) => {
        assert.equal(err.message, 'test')
        assert.equal(stub.callCount, 1)
        done()
      })
    })
  })

  describe('_startSubProcess', () => {
    it('should update pipelines', (done) => {
      let wrotePipelines = false
      let extensionWatcherIsStarted = false
      let pipelineWatcherIsStarted = false

      backendAction.extensionConfigWatcher.start = (cb) => {
        extensionWatcherIsStarted = true
        cb()
      }

      backendAction.pipelineWatcher.start = (cb) => {
        pipelineWatcherIsStarted = true
        cb()
      }

      backendAction._writeLocalPipelines = (cb) => {
        wrotePipelines = true
        cb()
      }

      utils.setProcessFile = (type, settingsFolder, pid) => {
        assert.ok(wrotePipelines, 'Pipeline was not downloaded and written')
        assert.ok(extensionWatcherIsStarted, 'ExtensionWatcher was not started')
        assert.ok(pipelineWatcherIsStarted, 'PipelineWatcher was not started')
        assert.equal(type, 'backend')
        assert.equal(settingsFolder, path.join(process.env.APP_PATH, AppSettings.SETTINGS_FOLDER))
        assert.equal(pid, process.pid)
        done()
      }
      backendAction._startSubProcess()
    })

    it('should throw an error if backend process cant connect', (done) => {
      backendAction.backendProcess.connect = (cb) => {
        try {
          cb(new Error('test'))
        } catch (err) {
          assert.equal(err.message, 'test')
          done()
        }
      }
      backendAction._startSubProcess()
    })

    it('should throw an error if pipelines cant be written', (done) => {
      backendAction.backendProcess.connect = (cb) => cb()
      backendAction._writeLocalPipelines = (cb) => {
        try {
          cb(new Error('test'))
        } catch (err) {
          assert.equal(err.message, 'test')
          done()
        }
      }
      backendAction._startSubProcess()
    })
  })

  describe('_extensionConfigChanged', () => {
    it('should write generated extension-config if backend-extension was updated', (done) => {
      let generated = { backend: {id: 'myGeneratedExtension'} }
      backendAction.dcClient.generateExtensionConfig = (config, appId, cb) => cb(null, generated)

      const cfgPath = path.join(process.env.APP_PATH, 'extensions', 'testExt')

      backendAction._extensionConfigChanged({ file: generated, path: cfgPath }, (err) => {
        assert.ifError(err)
        let cfg = fsEx.readJsonSync(path.join(cfgPath, 'extension', 'config.json'))
        assert.deepEqual(cfg, {id: 'myGeneratedExtension'})
        done()
      })
    })

    it('should write generated extension-config if frontend-extension was updated', (done) => {
      let generated = { frontend: {id: 'myGeneratedExtension'} }
      backendAction.dcClient.generateExtensionConfig = (config, appId, cb) => cb(null, generated)

      const cfgPath = path.join(process.env.APP_PATH, 'extension', 'testExt')

      backendAction._extensionConfigChanged({ file: generated, path: cfgPath }, (err) => {
        assert.ifError(err)
        let cfg = fsEx.readJsonSync(path.join(cfgPath, 'frontend', 'config.json'))
        assert.deepEqual(cfg, {id: 'myGeneratedExtension'})
        done()
      })
    })

    it('should throw an error if the extension generation has an error', function (done) {
      this.timeout(4000)
      let generated = { id: 'testExtension', frontend: {id: 'myGeneratedExtension'} }
      const stub = sinon.stub()
      stub.callsArgWith(2, new Error('test'))
      backendAction.dcClient.generateExtensionConfig = stub

      const cfgPath = path.join(process.env.APP_PATH, 'extension', 'testExt')

      backendAction._extensionConfigChanged({ file: generated, path: cfgPath }, (err) => {
        assert.equal(err.message, 'Could not generate Config for \'testExtension\'')
        assert.equal(stub.callCount, 5)
        done()
      })
    })
  })

  describe('_writeLocalPipelines', () => {
    it('should download and write pipeline', (done) => {
      let downloadedTrustedPipeine = false
      let downloadedPipeine = false
      const pipeline = { id: 'pipeline' }

      backendAction._writePipelines = (actualPipeline, pipelineFolder, cb) => {
        assert.equal(pipeline, actualPipeline)
        cb()
      }

      backendAction.dcClient.downloadPipelines = (appId, trusted, cb) => {
        if (trusted) downloadedTrustedPipeine = true
        if (!trusted) downloadedPipeine = true
        cb(null, pipeline)
      }

      backendAction._writeLocalPipelines((err) => {
        assert.ifError(err)
        assert.ok(downloadedTrustedPipeine, 'Trusted pipelines are not downloaded')
        assert.ok(downloadedPipeine, 'Pipelines are not downloaded')
        done()
      })
    })

    it('should throw an error if the downloading fails', (done) => {
      backendAction._writePipelines = (actualPipeline, pipelineFolder, cb) => {
        assert.fail('_writePipelines should not be called')
        cb()
      }

      backendAction.dcClient.downloadPipelines = (appId, trusted, cb) => {
        cb(new Error('Error while downloading'))
      }

      backendAction._writeLocalPipelines((err) => {
        assert.equal(err.message, 'Error while downloading')
        done()
      })
    })
  })

  describe('_writePipelines', () => {
    let tempPath
    beforeEach(() => {
      tempPath = fsEx.mkdtempSync(path.join(os.tmpdir(), 'cloud-sdk-'))
    })

    afterEach(() => {
      fsEx.removeSync(tempPath)
    })

    it('should create an empty folder and all pipelines', (done) => {
      const pipelines = [{'pipeline': {'id': 'getProductProperties_v1'}}]
      backendAction._writePipelines(pipelines, tempPath, (err) => {
        assert.ifError(err)
        const files = fsEx.readdirSync(tempPath)
        assert.equal(files.length, 1)
        assert.equal(files[0], 'getProductProperties_v1.json')
        done()
      })
    })
  })

  describe('_pipelineRemoved', () => {
    it('should remove a pipeline and reload plc', (done) => {
      const pipelineId = 'dCPlTest4'
      let called = false
      let pipelineReloadCalled = false
      backendAction.dcClient.removePipeline = (plId, id, trusted, cb) => {
        assert.equal(plId, pipelineId)
        called = true
        cb()
      }

      backendAction.backendProcess.triggerPipelineReload = (cb) => {
        pipelineReloadCalled = true
        cb()
      }

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest4.json')
      backendAction.pipelines[file] = {id: pipelineId}

      backendAction._pipelineRemoved(file, (err) => {
        assert.ifError(err)
        assert.ok(called)
        assert.ok(pipelineReloadCalled, 'Reloading of plc was not called')
        done()
      })
    })

    it('should skip if the pipeline is available', (done) => {
      let called = false
      backendAction.dcClient.removePipeline = (plId, id, trusted, cb) => {
        called = true
        cb()
      }
      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest4.json')

      backendAction._pipelineRemoved(file, (err) => {
        assert.ifError(err)
        assert.ok(!called, 'removePipeline should not get called')
        done()
      })
    })

    it('should retry 5 times after throwing an error', function (done) {
      this.timeout(4000)
      const pipelineId = 'dCPlTest4'
      const stub = sinon.stub()
      stub.callsArgWith(3, new Error('test'))
      backendAction.dcClient.removePipeline = stub

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest4.json')
      backendAction.pipelines[file] = {id: pipelineId}

      backendAction._pipelineRemoved(file, (err) => {
        assert.equal(err.message, 'Could not remove pipeline \'dCPlTest4\': test')
        assert.equal(stub.callCount, 5)
        done()
      })
    })

    it('should throw an error if pipeline reload throw an error', function (done) {
      const pipelineId = 'dCPlTest4'
      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest4.json')
      backendAction.pipelines[file] = {id: pipelineId}

      backendAction.dcClient.removePipeline = (plId, id, trusted, cb) => cb()

      backendAction.backendProcess.triggerPipelineReload = (cb) => {
        cb(new Error('test'))
      }
      backendAction._pipelineRemoved(file, (err) => {
        assert.equal(err.message, 'Could not remove pipeline \'dCPlTest4\': test')
        done()
      })
    })
  })
})
