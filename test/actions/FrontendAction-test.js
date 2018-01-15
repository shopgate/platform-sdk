const assert = require('assert')
const proxyquire = require('proxyquire')
const path = require('path')
const sinon = require('sinon')
const fsEx = require('fs-extra')
const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')

const appPath = path.join('build', 'appsettings')
const userPath = path.join('build', 'usersettings')

const fsExtraMock = {}

class FrontendActionMock {
  run () { return Promise.resolve() }
}

describe('FrontendAction', () => {
  let frontendAction
  const FrontendAction = proxyquire('../../lib/actions/FrontendAction', {
    '../logger': {
      info: () => {},
      error: () => {},
      debug: () => {}
    },
    '../app/frontend/FrontendProcess': FrontendActionMock,
    'fs-extra': fsExtraMock
  })

  beforeEach((done) => {
    process.env.USER_PATH = userPath
    fsEx.emptyDirSync(userPath)
    new UserSettings().setToken({})
    process.env.APP_PATH = appPath
    fsEx.emptyDirSync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    fsExtraMock.existsSync = () => true
    fsExtraMock.readJSONSync = () => {}
    new AppSettings().setId('foobarTest')
    frontendAction = new FrontendAction()
    done()
  })

  afterEach(() => {
    delete process.env.APP_PATH
    delete process.env.USER_PATH
  })

  describe('constructor', () => {
    it('should throw an error if user is not logged in', () => {
      new UserSettings().setToken(null)
      try {
        frontendAction = new FrontendAction()
        assert.fail()
      } catch (err) {
        assert.equal(err.message, 'You\'re not logged in! Please run `sgcloud login` again.')
      }
    })
  })

  describe('run() -> start', () => {
    it('should throw an error if the theme was not selected', () => {
      try {
        frontendAction.run('start')
        assert.fail()
      } catch (err) {
        assert.equal(err.message, 'Please pass the folder of the desired theme. Run `sgcloud frontend start -t <foldername of the theme>`')
      }
    })

    it('should throw an error if the theme is not existing', () => {
      const options = {theme: 'theme-gmd'}
      fsExtraMock.existsSync = (templateFolder) => {
        const expectedTemplateFolder = path.join(process.env.APP_PATH, AppSettings.THEMES_FOLDER, options.theme)
        assert.equal(templateFolder, expectedTemplateFolder)
        return null
      }
      try {
        frontendAction.run('start', options)
        assert.fail()
      } catch (err) {
        assert.equal(err.message, `Can't find theme ${options.theme}. Please make sure you passed the right theme.`)
      }
    })

    it('should generate theme config', (done) => {
      const options = {theme: 'theme-gmd'}
      const someExtensionConfig = {foo: 'bar'}
      const someAppJsonContent = {frontend: {bar: 'foo'}}
      fsExtraMock.readJSONSync = (extensionConfigJson) => {
        const expectedTemplateFolderPath = path.join(process.env.APP_PATH, AppSettings.THEMES_FOLDER, options.theme, 'extension-config.json')
        assert.equal(extensionConfigJson, expectedTemplateFolderPath)
        return someExtensionConfig
      }
      frontendAction.dcClient.generateExtensionConfig = (extensionConfigFile, applicationId, cb) => {
        assert.deepEqual(extensionConfigFile, someExtensionConfig)
        cb(null, someAppJsonContent)
      }

      fsExtraMock.outputJsonSync = (appJsonFilePath, config) => {
        const expectedAppJsonFilePath = path.join(process.env.APP_PATH, AppSettings.THEMES_FOLDER, options.theme, 'config/app.json')
        assert.equal(appJsonFilePath, expectedAppJsonFilePath)
        assert.equal(config, someAppJsonContent.frontend)
        done()
      }

      frontendAction.run('start', options)
    })

    it('should throw an error if the extension generation has an error', function () {
      this.timeout(4000)
      const stub = sinon.stub()
      stub.callsArgWith(2, new Error('test'))
      frontendAction.dcClient.generateExtensionConfig = stub
      const templateFolderPath = path.join(process.env.APP_PATH, AppSettings.THEMES_FOLDER, './theme-gmd/extension-config.json')

      return frontendAction.updateThemeConfig(templateFolderPath)
        .catch((err) => {
          assert.equal(err.message, 'Could not generate config: test')
        })
    })
  })

  describe('run() -> setup', () => {
    it('should run frontend setup', (done) => {
      frontendAction.frontendSetup.run = () => {
        done()
        return Promise.resolve()
      }
      frontendAction.run('setup', {theme: 'theme-gmd'})
    })
  })
})
