const assert = require('assert')
const sinon = require('sinon')
const path = require('path')
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
      const commander = {}
      commander.command = sinon.stub().returns(commander)
      commander.description = sinon.stub().returns(commander)
      commander.action = sinon.stub().returns(commander)

      backendAction.register(commander)

      assert(commander.command.calledWith('backend <action>'))
      assert(commander.description.calledOnce)
      assert(commander.action.calledOnce)
    })

    it('should throw if user not logged in', () => {
      userSettings.setToken()
      try {
        backendAction.run('start')
      } catch (err) {
        assert.equal(err.message, 'not logged in')
      }
    })

    it('should throw if invalid action is given', () => {
      try {
        backendAction.run('invalid')
      } catch (err) {
        assert.equal(err.message, 'unknown action "invalid"')
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

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest.json')
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
      const pipeline = {pipeline: {id: 'plFooBarline2'}}
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
      const pipeline = {pipeline: {id: 'plFooBarline3'}}
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

    it('should throw specific error if pipeline-file was invalid', (done) => {
      const BackendAction2 = proxyquire('../../lib/actions/BackendAction', {
        '../app/backend/BackendProcess': BackendProcess,
        '../logger': {
          info: () => {},
          error: (a, b) => {
            assert.deepEqual(a, {field: 'SomeField'})
            assert.equal(b, 'Pipeline invalid: Some detailed error message')
            done()
          },
          debug: () => {}
        }
      })

      backendAction = new BackendAction2()
      backendAction.dcClient = {}
      backendAction.pipelineWatcher = {
        close: () => {}
      }
      backendAction.extensionConfigWatcher = {
        stop: (cb) => cb()
      }

      const pipeline = {pipeline: {id: 'plFooBarline3'}}
      backendAction.dcClient.uploadPipeline = (pl, id, trusted, cb) => cb()

      const invalidErr = new Error()
      invalidErr.message = JSON.stringify({errors: [{field: 'SomeField', message: 'Some detailed error message'}]})
      invalidErr.code = 'PIPELINE_INVALID'
      backendAction._pipelineChanged = (file, cb) => cb(invalidErr)

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest3.json')
      fsEx.writeJsonSync(file, pipeline)
      backendAction._pipelineEvent(null, file)
    })

    it('should return if pipeline was removed', (done) => {
      const pipelineId = 'plFooBarline3'
      let called = false
      backendAction.dcClient.removePipeline = (plId, id, trusted, cb) => {
        assert.equal(plId, pipelineId)
        called = true
        cb()
      }

      const file = path.join(backendAction.pipelinesFolder, 'dCPlTest3.json')
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
