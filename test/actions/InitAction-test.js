const assert = require('assert')
const fsEx = require('fs-extra')
const nock = require('nock')
const os = require('os')
const path = require('path')
const sinon = require('sinon')
const { promisify } = require('util')
const DcHttpClient = require('../../lib/DcHttpClient')
const InitAction = require('../../lib/actions/InitAction')
const AppSettings = require('../../lib/app/AppSettings')
const { SETTINGS_FOLDER } = require('../../lib/app/Constants')
const config = require('../../lib/config')
const UserSettings = require('../../lib/user/UserSettings')

describe('InitAction', () => {
  let tempDir
  let userSettingsFolder
  let appPath
  let subjectUnderTest
  let userSettings
  let appSettings
  let dcHttpClient

  before(async () => {
    tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    userSettingsFolder = path.join(tempDir, 'user')
    appPath = path.join(tempDir, 'app')
    process.env.APP_PATH = appPath
    config.load({ userDirectory: userSettingsFolder })
  })

  beforeEach(async () => {
    process.env.SGCLOUD_DC_ADDRESS = 'http://test.test'
    process.env.APP_PATH = appPath
    await fsEx.emptyDir(userSettingsFolder)
    userSettings = new UserSettings()
    await userSettings.setToken({})
    appSettings = new AppSettings(appPath)
    dcHttpClient = new DcHttpClient(userSettings)
    subjectUnderTest = new InitAction(appSettings, userSettings, dcHttpClient)
  })

  afterEach(async () => {
    delete process.env.SGCLOUD_DC_ADDRESS
    delete process.env.APP_PATH
    await fsEx.emptyDir(userSettingsFolder)
    await fsEx.emptyDir(appPath)
  })

  after(async () => {
    await fsEx.remove(tempDir)
  })

  it('should register', () => {
    const commander = {}
    commander.command = sinon.stub().returns(commander)
    commander.description = sinon.stub().returns(commander)
    commander.option = sinon.stub().returns(commander)
    commander.action = sinon.stub().returns(commander)
    const userSettings = new UserSettings()
    const dcHttpClient = new DcHttpClient(userSettings)

    InitAction.register(commander, new AppSettings(appPath), userSettings, dcHttpClient)

    assert(commander.command.calledWith('init'))
    assert(commander.option.calledWith('--appId <appId>'))
    assert(commander.description.calledOnce)
    assert(commander.action.calledOnce)
  })

  it('should throw if user not logged in', async () => {
    await userSettings.setToken(null)
    try {
      await subjectUnderTest.run(null)
      assert.fail('Expected an error to be thrown.')
    } catch (err) {
      assert.equal(err.message, 'You\'re not logged in! Please run `sgconnect login` again.')
    }
  })

  it('should reinit the application if selected', async () => {
    const appId = 'foobarTest'
    await fsEx.emptyDir(path.join(appPath, SETTINGS_FOLDER))
    await appSettings.setId(appId)

    const dcMock = nock(process.env.SGCLOUD_DC_ADDRESS)
      .get(`/applications/test`)
      .reply(200, {})

    subjectUnderTest.permitDeletion = sinon.stub().resolves(true)

    try {
      await subjectUnderTest.run({appId: 'test'})
      await fsEx.remove(appPath)
      delete process.env.APP_PATH
      dcMock.done()
    } catch (err) {
      assert.ifError(err)
    }
  })

  it('should throw an error because getting the application data as validation fails', async () => {
    const dcMock = nock(process.env.SGCLOUD_DC_ADDRESS)
      .get(`/applications/test`)
      .reply(403, {})

    try {
      await subjectUnderTest.run({appId: 'test'})
      await fsEx.remove(appPath)
      delete process.env.APP_PATH
      assert.fail('Expected exception to be thrown.')
    } catch (err) {
      assert.equal(err.message, 'The application test is not available or permissions are missing (message: Getting application data failed). Please check the application at developer.shopgate.com!')
      dcMock.done()
    }
  })

  it('should create folders, settings file and save appId', async () => {
    const dcMock = nock(process.env.SGCLOUD_DC_ADDRESS)
      .get(`/applications/test`)
      .reply(200, {})

    try {
      await subjectUnderTest.run({appId: 'test'})
      await fsEx.remove(appPath)
      delete process.env.APP_PATH
      dcMock.done()
    } catch (err) {
      assert.ifError(err)
    }
  })

  describe('getAppId', () => {
    it('should return appId if already set in options', async () => {
      const expectedApplicationId = 'test'
      subjectUnderTest.options = {appId: expectedApplicationId}
      try {
        const applicationId = await subjectUnderTest.getAppId(null)
        assert.equal(applicationId, expectedApplicationId)
      } catch (err) {
        assert.ifError(err)
      }
    })

    it('should use prompt for appId if not set in options', async () => {
      const appId = 'test'
      subjectUnderTest.options = {}

      function prompt (questions) {
        assert.equal(questions.length, 1)
        assert.deepEqual(questions[0], {type: 'input', name: 'appId', message: 'Enter your Sandbox App ID:'})
        return Promise.resolve({appId: appId})
      }

      try {
        await subjectUnderTest.getAppId(prompt, (err, id) => {
          assert.ifError(err)
          assert.equal(id, appId)
        })
      } catch (err) {
        console.log(err)
        assert.fail(err.message)
      }
    })
  })

  describe('permitDeletion', () => {
    it('should use prompt', async () => {
      function prompt (question) {
        assert.deepEqual(question, {
          type: 'input',
          name: 'overwrite',
          default: 'n',
          message: 'Do you really want to overwrite your current application (appId)? (y/N)'
        })
        return Promise.resolve({overwrite: 'y'})
      }

      try {
        const response = await subjectUnderTest.permitDeletion(prompt, 'appId')
        assert.equal(response, true)
      } catch (err) {
        assert.ifError(err)
      }
    })
  })
})
