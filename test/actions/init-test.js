const init = require('../../lib/actions/init')
const assert = require('assert')
const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')
const path = require('path')
const userSettingsFolder = path.join('test', 'usersettings')
const appPath = path.join('test', 'appsettings')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

describe('actions', () => {
  describe('init', () => {
    it('should setup itself in commander', () => {
      const commander = {
        command: c => {
          assert.equal(c, 'init')
          return commander
        },
        description: d => {
          assert.ok(d)
          return commander
        },
        option: (o, d) => {
          assert.equal(o, '--appId <appId>')
          assert.ok(d)
          return commander
        },
        action: a => {
          assert.equal(a, init)
          return commander
        }
      }
      init.cmd(commander)
    })

    beforeEach(() => {
      process.env.USER_PATH = userSettingsFolder
    })

    afterEach((done) => {
      UserSettings.setInstance()
      delete process.env.USER_PATH
      rimraf(userSettingsFolder, done)
    })

    it('should throw if user not logged in', (done) => {
      UserSettings.getInstance().getSession().token = null
      try {
        init()
      } catch (err) {
        assert.equal(err.message, 'not logged in')
        done()
      }
    })

    it('should throw if application already initialized', (done) => {
      UserSettings.getInstance().getSession().token = {}
      const appId = 'foobarTest'

      process.env.APP_PATH = appPath
      const appSettings = new AppSettings()
      mkdirp.sync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
      appSettings.setId(appId).setAttachedExtensions({}).save().init()
      AppSettings.setInstance(appSettings)

      let wasCatched = false
      try {
        init()
      } catch (err) {
        wasCatched = true
        assert.equal(err.message, `The current folder is already initialized for application ${appId}`)
      }

      assert.ok(wasCatched)
      delete process.env.APP_PATH
      AppSettings.setInstance()
      rimraf(appPath, done)
    })

    it('should create folders, settings file and save appId', (done) => {
      AppSettings.setInstance()
      process.env.APP_PATH = appPath
      UserSettings.getInstance().getSession().token = {}

      init({appId: 'test'}, () => {
        delete process.env.APP_PATH
        AppSettings.setInstance()
        rimraf(appPath, done)
      })
    })
  })
})
