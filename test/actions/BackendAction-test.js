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
}

describe('BackendAction', () => {
  let backendAction
  const BackendAction = proxyquire('../../lib/actions/BackendAction', {
    '../app/backend/BackendProcess': BackendProcess,
    '../logger': {
      info: () => {},
      error: () => {},
      debug: () => {}
    }
  })

  let userSettings
  let appSettings

  before(() => {
    process.env.USER_PATH = userSettingsFolder
    process.env.APP_PATH = appPath
    fsEx.emptyDirSync(userSettingsFolder)
    fsEx.emptyDirSync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
  })

  beforeEach(function (done) {
    fsEx.emptyDirSync(userSettingsFolder)
    process.env.USER_PATH = userSettingsFolder
    fsEx.emptyDirSync(path.join(appPath, AppSettings.SETTINGS_FOLDER))

    userSettings = new UserSettings().setToken({})
    appSettings = new AppSettings().setId('foobarTest')

    backendAction = new BackendAction()
    backendAction.userSettings = userSettings
    backendAction.appSettings = appSettings

    fsEx.emptyDirSync(backendAction.pipelinesFolder)
    backendAction.pipelineWatcher = {
      start: (cb) => cb(),
      close: () => {},
      on: (event, fn) => fn(event, path.join(backendAction.pipelinesFolder, 'testPipeline.json'))
    }
    backendAction.extensionConfigWatcher = {
      stop: (cb) => cb()
    }

    backendAction.cliProxy = {
      start: (cb) => cb(),
      close: (cb) => cb()
    }

    backendAction.dcClient = {}
    done()
  })

  afterEach((done) => {
    backendAction.pipelineWatcher.close()
    backendAction.extensionConfigWatcher.stop(done)
  })

  after(() => {
    fsEx.removeSync(userSettingsFolder)
    fsEx.removeSync(appPath)
  })

  describe('general', () => {
    it('should register', () => {
      const caporal = {}
      caporal.command = sinon.stub().returns(caporal)
      caporal.description = sinon.stub().returns(caporal)
      caporal.action = sinon.stub().returns(caporal)

      backendAction.register(caporal)

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

    it('should throw if invalid action is given', (done) => {
      try {
        backendAction.run('invalid')
      } catch (err) {
        assert.equal(err.message, 'unknown action "invalid"')
        done()
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

  describe('watching', () => {
    it('should update pipelines', (done) => {
      backendAction.backendProcess = new BackendProcess()

      backendAction.extensionConfigWatcher = {
        start: (cb) => cb(),
        stop: (cb) => cb(),
        on: (name, fn) => fn()
      }

      backendAction.dcClient.downloadPipelines = (appId, trusted, cb) => cb(null, [{pipeline: {id: 'testPipeline'}}])
      backendAction.dcClient.removePipeline = (pId, aId, trusted, cb) => cb()
      backendAction._extensionChanged = (cfg, cb = () => {}) => cb()

      try {
        backendAction._startSubProcess()
      } catch (err) {
        assert.ifError(err)
      }

      setTimeout(() => {
        assert.deepEqual(
          fsEx.readJsonSync(path.join(process.env.APP_PATH, 'pipelines', 'testPipeline.json')),
          {pipeline: {id: 'testPipeline'}}
        )
        done()
      }, 50)
    })

    it('should call dcClient if pipelines were updated', (done) => {
      const pipeline = {pipeline: {id: 'plFooBarline1'}}
      const appId = 'foobarAppIdDcTestBackendAction'
      appSettings.setId(appId)

      const file = path.join(backendAction.pipelinesFolder, 'plFooBarline1.json')
      assert.equal(backendAction.pipelines[file], undefined)

      backendAction.dcClient.uploadPipeline = (f, aId, trusted, cb) => {
        assert.deepEqual(backendAction.pipelines[file].id, pipeline.pipeline.id)
        assert.deepEqual(f, pipeline)
        assert.equal(aId, appId)
        cb()
      }

      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file, done)
      })
    })

    it('should write generated extension-config if backend-extension was updated', (done) => {
      let generated = { backend: {id: 'myGeneratedExtension'} }
      backendAction.dcClient.generateExtensionConfig = (config, appId, cb) => cb(null, generated)

      const cfgPath = path.join(process.env.APP_PATH, 'extensions', 'testExt')

      backendAction._extensionChanged({ file: generated, path: cfgPath }, (err) => {
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

      backendAction._extensionChanged({ file: generated, path: cfgPath }, (err) => {
        assert.ifError(err)
        let cfg = fsEx.readJsonSync(path.join(cfgPath, 'frontend', 'config.json'))
        assert.deepEqual(cfg, {id: 'myGeneratedExtension'})
        done()
      })
    })

    it('should throw error if dcClient is not reachable', (done) => {
      const pipeline = {pipeline: {id: 'dCPlTest2'}}
      backendAction.dcClient.uploadPipeline = (pl, id, trusted, cb) => cb(new Error('error'))

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

    it('should return if pipeline was changed', (done) => {
      const pipeline = {pipeline: {id: 'dCPlTest3'}}
      backendAction.dcClient.uploadPipeline = (pl, id, trusted, cb) => cb()

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest3.json')
      fsEx.writeJson(file, pipeline, (err) => {
        assert.ifError(err)
        backendAction._pipelineChanged(file, (err) => {
          assert.ifError(err)
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

    it('should return if pipeline was removed', (done) => {
      const pipelineId = 'dCPlTest4'
      let called = false
      backendAction.dcClient.removePipeline = (plId, id, trusted, cb) => {
        assert.equal(plId, pipelineId)
        called = true
        cb()
      }

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest4.json')
      backendAction.pipelines[file] = {id: pipelineId}

      backendAction._pipelineRemoved(file, (err) => {
        assert.ifError(err)
        assert.ok(called)
        done()
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
