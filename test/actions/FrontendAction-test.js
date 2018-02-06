const assert = require('assert')
const proxyquire = require('proxyquire')
const path = require('path')
const fsEx = require('fs-extra')
const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')

const appPath = path.join('build', 'appsettings')
const userPath = path.join('build', 'usersettings')

const fsExtraMock = {}
const inquirer = {}
const dcClientMock = class {}

class FrontendProcessMock {
  run () { return Promise.resolve() }
}

describe('FrontendAction', () => {
  let subjectUnderTest
  let appSettings
  let userSetting
  const FrontendAction = proxyquire('../../lib/actions/FrontendAction', {
    '../logger': {
      info: () => {},
      error: () => {},
      debug: () => {},
      warn: () => {}
    },
    '../app/frontend/FrontendProcess': FrontendProcessMock,
    'fs-extra': fsExtraMock,
    'inquirer': inquirer,
    '../DcHttpClient': dcClientMock
  })

  beforeEach(async () => {
    process.env.USER_PATH = userPath
    await fsEx.emptyDir(userPath)
    userSetting = await new UserSettings().setToken({})
    await fsEx.emptyDir(path.join(appPath, AppSettings.SETTINGS_FOLDER))

    fsExtraMock.existsSync = () => true
    fsExtraMock.readJSONSync = () => {}
    fsExtraMock.readdir = () => Promise.resolve()
    fsExtraMock.lstat = () => Promise.resolve()

    appSettings = await new AppSettings(appPath).setId('foobarTest')
    subjectUnderTest = new FrontendAction(appSettings, userSetting)
  })

  afterEach(() => {
    delete process.env.APP_PATH
    delete process.env.USER_PATH
  })

  describe('constructor', async () => {
    it('should throw an error if user is not logged in', async () => {
      userSetting.setToken(null)
      try {
        // re-create the subject under test after token was set to null
        subjectUnderTest = new FrontendAction(appSettings, userSetting)
      } catch (err) {
        assert.ok(err)
        assert.equal(err.message, 'You\'re not logged in! Please run `sgcloud login` again.')
      }
    })
  })

  describe('run() -> start', async () => {
    userSetting = await new UserSettings().setToken({})
    it('should throw an error if the theme is not existing', async () => {
      const options = {theme: 'theme-gmd'}
      fsExtraMock.readdir = (source) => Promise.resolve(['a', 'b'])
      fsExtraMock.lstat = () => Promise.resolve({isDirectory: () => true})
      fsExtraMock.exists = () => Promise.resolve(false)
      subjectUnderTest.dcClient.generateExtensionConfig = (configFile, id, cb) => { cb(null, {}) }

      try {
        await subjectUnderTest.run('start', null, options)
        assert.fail()
      } catch (err) {
        assert.equal(err.message, 'Can\'t find theme \'theme-gmd\'. Please make sure you passed the right theme.')
      }
    })

    it('should generate theme config', async () => {
      const options = {theme: 'theme-gmd'}
      fsExtraMock.readJSON = () => Promise.resolve({})
      fsExtraMock.readdir = () => Promise.resolve(['theme-gmd'])
      fsExtraMock.exists = () => Promise.resolve(true)
      fsExtraMock.lstat = () => Promise.resolve({isDirectory: () => true})
      subjectUnderTest.dcClient.generateExtensionConfig = () => Promise.resolve({})

      try {
        await subjectUnderTest.run('start', {}, options)
      } catch (err) {
        assert.ifError(err)
      }
    })
  })

  describe('run() -> setup', () => {
    it('should run frontend setup', (done) => {
      subjectUnderTest.frontendSetup.run = () => {
        done()
        return Promise.resolve()
      }
      subjectUnderTest.run('setup', {theme: 'theme-gmd'})
    })
  })
})
