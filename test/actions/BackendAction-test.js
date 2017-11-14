/* eslint-disable standard/no-callback-literal */
const assert = require('assert')
const mock = require('mock-require')
const sinon = require('sinon')
const path = require('path')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')
const userSettingsFolder = path.join('test', 'usersettings')
const appPath = path.join('test', 'appsettings')

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
  let BackendAction
  let backendAction

  before(() => {
    mock('../../lib/app/backend/BackendProcess', BackendProcess)
    BackendAction = mock.reRequire('../../lib/actions/BackendAction')
    backendAction = new BackendAction()
  })

  after(() => {
    mock.stopAll()
  })

  beforeEach(() => {
    process.env.USER_PATH = userSettingsFolder
    process.env.APP_PATH = appPath
    const appSettings = new AppSettings()
    mkdirp.sync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    appSettings.setId('foobarTest').setAttachedExtensions({}).save().init()
    AppSettings.setInstance(appSettings)
    UserSettings.getInstance().getSession().token = {}
  })

  afterEach((done) => {
    UserSettings.setInstance()
    delete process.env.USER_PATH
    if (backendAction.pipelineWatcher) {
      backendAction.pipelineWatcher.stop((err) => {
        if (err) return done(err)
        rimraf(userSettingsFolder, () => {
          rimraf(path.join('extensions'), done)
        })
      })
    } else {
      rimraf(userSettingsFolder, () => {
        rimraf(path.join('extensions'), done)
      })
    }
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
      UserSettings.getInstance().getSession().token = null
      try {
        backendAction.run('attach')
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

    it('should call dcClient if pipelines were updated', (done) => {
      backendAction.dcClient = {
        updatePipeline: (pipeline, id, userSession, cb) => {
          done()
          cb()
        }
      }
      backendAction.backendProcess = {
        connect: (cb) => { cb() }
      }
      backendAction.pipelineWatcher = {
        start: () => { return backendAction.pipelineWatcher },
        stop: (cb) => { cb() },
        on: (name, cb) => {
          cb({
            pipeline: {pipeline: {id: 'testPipeline'}}
          })
        }
      }

      backendAction._startSubProcess()
    })

    it('should throw error if dcClient is not reachable', (done) => {
      backendAction.dcClient = {
        updatePipeline: (pipeline, id, userSession, cb) => {
          cb({message: 'EUNKNOWN'})
        }
      }
      backendAction.backendProcess = {
        connect: (cb) => { cb() }
      }
      backendAction.pipelineWatcher = {
        start: () => { return backendAction.pipelineWatcher },
        stop: (cb) => { cb() },
        on: (name, cb) => {
          cb({
            pipeline: {pipeline: {id: 'testPipeline'}}
          })
        }
      }
      try {
        backendAction._startSubProcess()
      } catch (err) {
        assert.ok(err)
        assert.equal(err.message, `Could not update pipeline 'undefined' (EUNKNOWN)`)
        done()
      }
    })

    it('shold work', () => {
      try {
        backendAction.run('start')
      } catch (err) {
        assert.ifError(err)
      }
    })
  })
})
