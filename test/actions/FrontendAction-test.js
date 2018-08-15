const assert = require('assert')
const proxyquire = require('proxyquire')
const path = require('path')
const fsEx = require('fs-extra')
const sinon = require('sinon')
const AppSettings = require('../../lib/app/AppSettings')
const UserSettings = require('../../lib/user/UserSettings')
const DcHttpClient = require('../../lib/DcHttpClient')
const mockFs = require('mock-fs')
const { SETTINGS_FOLDER } = require('../../lib/app/Constants')
const utils = require('../../lib/utils/utils')

const appPath = path.join('build', 'appsettings')
const userPath = path.join('build', 'usersettings')

const fsExtraMock = {}
const inquirer = {}

class FrontendProcessMock {
  run () { return Promise.resolve() }
}

describe('FrontendAction', () => {
  let subjectUnderTest
  let appSettings
  let userSettings
  let dcHttpClient

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
    '../utils/utils': utils
  })

  beforeEach(async () => {
    mockFs()
    process.env.USER_PATH = userPath
    await fsEx.emptyDir(userPath)
    userSettings = await new UserSettings().setToken({})
    await fsEx.emptyDir(path.join(appPath, SETTINGS_FOLDER))
    dcHttpClient = new DcHttpClient(userSettings, null)

    dcHttpClient.checkPermissions = async () => (true)
    fsExtraMock.existsSync = () => true
    fsExtraMock.readJSONSync = () => {}
    fsExtraMock.readdir = () => Promise.resolve()
    fsExtraMock.lstat = () => Promise.resolve()

    appSettings = await new AppSettings(appPath).setId('foobarTest')
    appSettings.loadAttachedExtensions = async () => ({})
    subjectUnderTest = new FrontendAction(appSettings, userSettings, dcHttpClient)

    subjectUnderTest.extensionConfigWatcher = {
      start: () => sinon.stub().resolves(),
      on: () => sinon.stub().resolves(),
      stop: () => sinon.stub().resolves()
    }
  })

  afterEach(() => {
    delete process.env.APP_PATH
    delete process.env.USER_PATH
    mockFs.restore()
  })

  describe('constructor', async () => {
    it('should throw an error if user is not logged in', async () => {
      userSettings.setToken(null)
      try {
        // re-create the subject under test after token was set to null
        subjectUnderTest = new FrontendAction(appSettings, userSettings)
      } catch (err) {
        assert.ok(err)
        assert.equal(err.message, 'You\'re not logged in! Please run `sgconnect login` again.')
      }
    })
  })

  describe('run() -> start', () => {
    it('should throw an error if the theme is not existing', async () => {
      const options = { theme: 'theme-gmd' }
      fsExtraMock.readdir = (source) => Promise.resolve(['a', 'b'])
      fsExtraMock.lstat = () => Promise.resolve({ isDirectory: () => true })
      fsExtraMock.exists = () => Promise.resolve(false)
      subjectUnderTest.dcHttpClient.generateExtensionConfig = (configFile, id, cb) => { cb(null, {}) }
      subjectUnderTest.setStartPage = () => Promise.resolve()

      try {
        await subjectUnderTest.run('start', null, options)
        assert.fail()
      } catch (err) {
        assert.equal(err.message, 'Can\'t find theme \'theme-gmd\'. Please make sure you passed the right theme.')
      }
    })

    it('should generate theme config', async () => {
      const options = { theme: 'theme-gmd' }
      fsExtraMock.readJSON = () => Promise.resolve({})
      fsExtraMock.readdir = () => Promise.resolve(['theme-gmd'])
      fsExtraMock.exists = () => Promise.resolve(true)
      fsExtraMock.lstat = () => Promise.resolve({ isDirectory: () => true })
      subjectUnderTest.dcHttpClient.generateExtensionConfig = () => Promise.resolve({})
      subjectUnderTest.setStartPage = () => Promise.resolve()

      let gotCalled = false
      utils.generateComponentsJson = () => { gotCalled = true }

      try {
        await subjectUnderTest.run('start', {}, options)
        assert.ok(gotCalled)
      } catch (err) {
        assert.ifError(err)
      }
    })

    it('should set the local theme URL', async () => {
      const options = { theme: 'theme-gmd' }
      fsExtraMock.readJSON = () => Promise.resolve({})
      fsExtraMock.readdir = () => Promise.resolve(['theme-gmd'])
      fsExtraMock.exists = () => Promise.resolve(true)
      fsExtraMock.lstat = () => Promise.resolve({ isDirectory: () => true })
      subjectUnderTest.dcHttpClient.generateExtensionConfig = () => Promise.resolve({})

      appSettings.getFrontendSettings = () => { return { getIpAddress: () => '1.2.3.4', getPort: () => 8080 } }

      subjectUnderTest.setStartPage = (appId, address, port) => {
        assert.equal(appId, 'foobarTest')
        assert.equal(address, '1.2.3.4')
        assert.equal(port, 8080)
      }

      try {
        await subjectUnderTest.run('start', null, options)
      } catch (err) {
        throw err
      }
    })
  })

  describe('requestThemeOption', () => {
    it('should ask which theme to use', (done) => {
      const choice = 'theme-gmd'
      const choices = ['theme-gmd', 'theme-super']
      inquirer.prompt = async (args) => {
        assert.deepEqual(args[0].choices, choices)
        return { theme: choice }
      }

      utils.findThemes = () => Promise.resolve(choices)

      subjectUnderTest.requestThemeOption().then((result) => {
        assert.equal(choice, result)
        done()
      })
    })
  })

  describe('run() -> setup', () => {
    it('should run frontend setup', (done) => {
      subjectUnderTest.frontendSetup.run = () => {
        done()
        return Promise.resolve()
      }
      subjectUnderTest.run('setup', { theme: 'theme-gmd' })
    })
  })

  describe('setStartPage', () => {
    it('should call DC to set the start page', async () => {
      subjectUnderTest.dcHttpClient.setStartPageUrl = (appId, url) => {
        assert.equal(appId, 'foobarTest')
        assert.equal(url, 'http://1.2.3.4:8080')
      }

      try {
        await subjectUnderTest.setStartPage('foobarTest', '1.2.3.4', '8080')
      } catch (err) {
        assert.ifError(err)
      }
    })
  })

  describe('resetStartPage', () => {
    it('should call DC to set the start page to a blank string', async () => {
      subjectUnderTest.dcHttpClient.setStartPageUrl = (appId, url) => {
        assert.equal(appId, 'foobarTest')
        assert.strictEqual(url, '')
      }

      try {
        await subjectUnderTest.resetStartPage('foobarTest')
      } catch (err) {
        assert.ifError(err)
      }
    })
  })
})
