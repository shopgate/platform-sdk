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
  let subjectUnderTest
  let userSettings
  let appSettings

  it('should register', () => {
    const commander = {}
    commander.command = sinon.stub().returns(commander)
    commander.description = sinon.stub().returns(commander)
    commander.option = sinon.stub().returns(commander)
    commander.action = sinon.stub().returns(commander)

    InitAction.register(commander, new AppSettings(appPath))

    assert(commander.command.calledWith('init'))
    assert(commander.option.calledWith('--appId <appId>'))
    assert(commander.description.calledOnce)
    assert(commander.action.calledOnce)
  })

  beforeEach(() => {
    process.env.USER_PATH = userSettingsFolder
    process.env.SGCLOUD_DC_ADDRESS = 'http://test.test'
    fsEx.emptyDirSync(userSettingsFolder)
    userSettings = new UserSettings()
    appSettings = new AppSettings(appPath)
    subjectUnderTest = new InitAction(appSettings)
  })

  afterEach((done) => {
    delete process.env.USER_PATH
    delete process.env.SGCLOUD_DC_ADDRESS
    fsEx.remove(userSettingsFolder, () => {
      delete process.env.APP_PATH
      fsEx.remove(appPath, done)
    })
  })

  it('should throw if user not logged in', (done) => {
    userSettings.setToken(null)
    subjectUnderTest.run(null)
      .catch(err => {
        assert.equal(err.message, 'You\'re not logged in! Please run `sgcloud login` again.')
        done()
      })
  })

  it('should reinit the application if selected', (done) => {
    userSettings.setToken({})
    const appId = 'foobarTest'
    fsEx.emptyDirSync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    appSettings.setId(appId)

    const dcMock = nock(process.env.SGCLOUD_DC_ADDRESS)
      .get(`/applications/test`)
      .reply(200, {})

    subjectUnderTest.permitDeletion = (prompt, appId, cb) => cb(null, true)

    subjectUnderTest.run({appId: 'test'}, (err) => {
      fsEx.remove(appPath, (err2) => {
        assert.ifError(err)
        assert.ifError(err2)
        delete process.env.APP_PATH
        dcMock.done()
        done()
      })
    })
  })

  it('should throw an error because getting the application data as validation fails', (done) => {
    userSettings.setToken({})

    const dcMock = nock(process.env.SGCLOUD_DC_ADDRESS)
    .get(`/applications/test`)
    .reply(403, {})

    subjectUnderTest = new InitAction(new AppSettings(appPath))
    subjectUnderTest.run({appId: 'test'}, (err) => {
      fsEx.remove(appPath, () => {
        assert.equal(err.message, 'The application test is not available or permissions are missing (message: Getting application data failed). Please check the application at developer.shopgate.com!')
        delete process.env.APP_PATH
        dcMock.done()
        done()
      })
    })
  })

  it('should create folders, settings file and save appId', (done) => {
    userSettings.setToken({})

    const dcMock = nock(process.env.SGCLOUD_DC_ADDRESS)
    .get(`/applications/test`)
    .reply(200, {})

    subjectUnderTest = new InitAction(new AppSettings(appPath))
    subjectUnderTest.run({appId: 'test'}, (err) => {
      fsEx.remove(appPath, (err2) => {
        assert.ifError(err)
        assert.ifError(err2)
        delete process.env.APP_PATH
        dcMock.done()
        done()
      })
    })
  })

  describe('getAppId', () => {
    it('should return appId if already set in options', (done) => {
      const applicationId = 'test'
      subjectUnderTest.options = {appId: applicationId}
      subjectUnderTest.getAppId(null, (err, id) => {
        assert.ifError(err)
        assert.equal(id, applicationId)
        done()
      })
    })

    it('should use prompt for appId if not set in options', (done) => {
      const appId = 'test'
      subjectUnderTest.options = {}

      function prompt (questions) {
        assert.equal(questions.length, 1)
        assert.deepEqual(questions[0], {type: 'input', name: 'appId', message: 'Enter your Sandbox App ID:'})
        return Promise.resolve({appId: appId})
      }

      subjectUnderTest.getAppId(prompt, (err, id) => {
        assert.ifError(err)
        assert.equal(id, appId)
        done()
      })
    })
  })

  describe('permitDeletion', () => {
    it('should use prompt', (done) => {
      function prompt (question) {
        assert.deepEqual(question, {type: 'input', name: 'overwrite', default: 'n', message: 'Do you really want to overwrite your current application (appId)? (y/N)'})
        return Promise.resolve({overwrite: 'y'})
      }

      subjectUnderTest.permitDeletion(prompt, 'appId', (err, res) => {
        assert.ifError(err)
        assert.equal(res, true)
        done()
      })
    })
  })
})
