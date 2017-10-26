const detachExtension = require('../../lib/actions/detachExtension')
const assert = require('assert')
const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')
const path = require('path')
const userSettingsFolder = path.join('test', 'usersettings')
const appPath = path.join('test', 'appsettings')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
require('mocha-sinon')

describe('actions', () => {
  describe('detachExtension', () => {
    it('should setup itself in commander', () => {
      const commander = {
        command: c => {
          assert.equal(c, 'detachExtension [extensionNames...]')
          return commander
        },
        description: d => {
          assert.ok(d)
          return commander
        },
        action: a => {
          assert.equal(a, detachExtension)
          return commander
        }
      }
      detachExtension.cmd(commander)
    })

    beforeEach(() => {
      process.env.USER_PATH = userSettingsFolder
      const appId = 'foobarTest'

      process.env.APP_PATH = appPath
      const appSettings = new AppSettings()
      mkdirp.sync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
      appSettings.setId(appId).save().init()
      AppSettings.setInstance(appSettings)

      UserSettings.getInstance().getSession().token = {}
    })

    afterEach((done) => {
      UserSettings.setInstance()
      delete process.env.USER_PATH
      rimraf(userSettingsFolder, () => {
        rimraf(path.join(appPath, AppSettings.SETTINGS_FOLDER), done)
      })
    })

    it('should throw if user not logged in', () => {
      UserSettings.getInstance().getSession().token = null
      try {
        detachExtension()
      } catch (err) {
        assert.equal(err.message, 'not logged in')
      }
    })

    it('should detach a extension', () => {
      const name = 'existentExtension'

      AppSettings.getInstance().attachExtension(name)
      detachExtension([name])
      assert.equal(AppSettings.getInstance().attachedExtensions.length, 0)
    })

    it('should skip if extension was not attached', (done) => {
      const name = 'notExitstentExtension'

      console.warn = (text) => {
        assert.equal(text, `The extension '${name}' is not attached`)
        assert.equal(AppSettings.getInstance().attachedExtensions, undefined)
        done()
      }

      detachExtension([name])
    })

    it('should remove all extensions if none are specified', () => {
      const names = ['extension1', 'extension2']

      names.forEach(name => {
        AppSettings.getInstance().attachExtension(name)
      })

      detachExtension([])
      assert.equal(AppSettings.getInstance().attachedExtensions.length, 0)
    })
  })
})
