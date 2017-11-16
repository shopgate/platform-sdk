const assert = require('assert')
const mock = require('mock-require')
const sinon = require('sinon')
const path = require('path')
const fsEx = require('fs-extra')
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
    rimraf(userSettingsFolder, () => {
      rimraf(path.join('extensions'), done)
    })
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

    it('should update pipelines', (done) => {
      backendAction.backendProcess = new BackendProcess()
      backendAction.dcClient = {
        getPipelines: (appId, cb) => {
          cb(null, [{
            pipeline: {
              id: 'testPipeline'
            }
          }])
        }
      }

      try {
        backendAction._startSubProcess()
      } catch (err) {
        assert.ifError(err)
      }

      setTimeout(() => {
        assert.deepEqual(
          fsEx.readJsonSync(path.join(process.env.APP_PATH, 'pipelines', 'testPipeline.json')),
          {
            pipeline: {
              id: 'testPipeline'
            }
          }
        )
        done()
      }, 50)
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
