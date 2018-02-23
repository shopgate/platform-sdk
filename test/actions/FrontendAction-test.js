const assert = require('assert')
const proxyquire = require('proxyquire')
const path = require('path')
const fsEx = require('fs-extra')
const sinon = require('sinon')
const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')

const appPath = path.join('build', 'appsettings')
const userPath = path.join('build', 'usersettings')

const fsExtraMock = {}
const inquirer = {}
const dcClientMock = class {}

class FrontendActionMock {
  run () { return Promise.resolve() }
}

describe('FrontendAction', () => {
  let frontendAction
  const FrontendAction = proxyquire('../../lib/actions/FrontendAction', {
    '../logger': {
      info: () => {},
      error: () => {},
      debug: () => {},
      warn: () => {}
    },
    '../app/frontend/FrontendProcess': FrontendActionMock,
    'fs-extra': fsExtraMock,
    'inquirer': inquirer,
    '../DcHttpClient': dcClientMock
  })

  beforeEach((done) => {
    process.env.USER_PATH = userPath
    fsEx.emptyDirSync(userPath)
    new UserSettings().setToken({})
    process.env.APP_PATH = appPath
    fsEx.emptyDirSync(path.join(appPath, AppSettings.SETTINGS_FOLDER))

    fsExtraMock.existsSync = () => true
    fsExtraMock.readJSONSync = () => {}
    fsExtraMock.readdir = () => Promise.resolve()
    fsExtraMock.lstat = () => Promise.resolve()

    new AppSettings().setId('foobarTest')
    frontendAction = new FrontendAction()

    frontendAction.extensionConfigWatcher = {
      start: () => sinon.stub().resolves(),
      on: () => sinon.stub().resolves(),
      stop: () => sinon.stub().resolves()
    }

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
    it('should throw an error if the theme is not existing', async () => {
      const options = {theme: 'theme-gmd'}
      fsExtraMock.readdir = (source) => Promise.resolve(['a', 'b'])
      fsExtraMock.lstat = () => Promise.resolve({isDirectory: () => true})
      fsExtraMock.exists = () => Promise.resolve(false)
      frontendAction.dcClient.generateExtensionConfig = (configFile, id, cb) => { cb(null, {}) }

      try {
        await frontendAction.run('start', null, options)
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
      frontendAction.dcClient.generateExtensionConfig = () => Promise.resolve({})

      try {
        await frontendAction.run('start', {}, options)
      } catch (err) {
        assert.ifError(err)
      }
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
