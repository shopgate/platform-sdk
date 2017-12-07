const InitAction = require('../../lib/actions/InitAction')
const assert = require('assert')
const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')
const path = require('path')
const userSettingsFolder = path.join('build', 'usersettings')
const appPath = path.join('build', 'appsettings')
const sinon = require('sinon')
const fsEx = require('fs-extra')
const nock = require('nock')

describe('InitAction', () => {
  it('should register', () => {
    const commander = {}
    commander.command = sinon.stub().returns(commander)
    commander.description = sinon.stub().returns(commander)
    commander.option = sinon.stub().returns(commander)
    commander.action = sinon.stub().returns(commander)

    new InitAction().register(commander)

    assert(commander.command.calledWith('init'))
    assert(commander.option.calledWith('--appId <appId>'))
    assert(commander.description.calledOnce)
    assert(commander.action.calledOnce)
  })

  beforeEach(() => {
    process.env.USER_PATH = userSettingsFolder
    process.env.SGCLOUD_DC_ADDRESS = 'http://test.test'
    fsEx.emptyDirSync(userSettingsFolder)
  })

  afterEach((done) => {
    UserSettings.setInstance()
    delete process.env.USER_PATH
    delete process.env.SGCLOUD_DC_ADDRESS
    fsEx.remove(userSettingsFolder, done)
  })

  it('should throw if user not logged in', (done) => {
    UserSettings.getInstance().getSession().token = null
    const init = new InitAction()
    init.run(null, (err) => {
      assert.equal(err.message, 'not logged in')
      done()
    })
  })

  it('should throw if application already initialized', (done) => {
    UserSettings.getInstance().getSession().token = {}
    const appId = 'foobarTest'

    process.env.APP_PATH = appPath
    const appSettings = new AppSettings()
    fsEx.emptyDirSync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    appSettings.setId(appId).save().init()
    AppSettings.setInstance(appSettings)

    const init = new InitAction()

    init.run(null, (err) => {
      assert.equal(err.message, `The current folder is already initialized for application ${appId}`)
      delete process.env.APP_PATH
      AppSettings.setInstance()
      fsEx.remove(appPath, done)
    })
  })

  it('should throw an error because getting the application data as validation fails', (done) => {
    AppSettings.setInstance()
    process.env.APP_PATH = appPath
    UserSettings.getInstance().getSession().token = {}

    const dcMock = nock(process.env.SGCLOUD_DC_ADDRESS)
    .get(`/applications/test`)
    .reply(403, {})

    new InitAction().run({appId: 'test'}, (err) => {
      fsEx.remove(appPath, () => {
        assert.equal(err.message, 'The application test is not available or permissions are missing (message: Getting application data failed). Please check the application at developer.shopgate.com!')
        delete process.env.APP_PATH
        AppSettings.setInstance()
        dcMock.done()
        done()
      })
    })
  })

  it('should create folders, settings file and save appId', (done) => {
    AppSettings.setInstance()
    process.env.APP_PATH = appPath
    UserSettings.getInstance().getSession().token = {}

    const dcMock = nock(process.env.SGCLOUD_DC_ADDRESS)
    .get(`/applications/test`)
    .reply(200, {})

    new InitAction().run({appId: 'test'}, (err) => {
      fsEx.remove(appPath, (err2) => {
        assert.ifError(err)
        assert.ifError(err2)
        delete process.env.APP_PATH
        AppSettings.setInstance()
        dcMock.done()
        done()
      })
    })
  })

  describe('getAppId', () => {
    it('should return appId if already set in options', (done) => {
      const init = new InitAction()
      const applicationId = 'test'
      init.options = {appId: applicationId}
      init.getAppId(null, (err, id) => {
        assert.ifError(err)
        assert.equal(id, applicationId)
        done()
      })
    })

    it('should use prompt for appId if not set in options', (done) => {
      const init = new InitAction()
      const appId = 'test'
      init.options = {}

      function prompt (questions) {
        assert.equal(questions.length, 1)
        assert.deepEqual(questions[0], {type: 'input', name: 'appId', message: 'Enter your Sandbox App ID:'})
        return Promise.resolve({appId: appId})
      }

      init.getAppId(prompt, (err, id) => {
        assert.ifError(err)
        assert.equal(id, appId)
        done()
      })
    })
  })
})
