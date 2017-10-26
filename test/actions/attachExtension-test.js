const attachExtension = require('../../lib/actions/attachExtension')
const assert = require('assert')
const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')
const path = require('path')
const userSettingsFolder = path.join('test', 'usersettings')
const appPath = path.join('test', 'appsettings')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const fsEx = require('fs-extra')

describe('actions', () => {
  describe('attachExtension', () => {
    it('should setup itself in commander', () => {
      const commander = {
        command: c => {
          assert.equal(c, 'extension attach [extensionNames...]')
          return commander
        },
        description: d => {
          assert.ok(d)
          return commander
        },
        action: a => {
          assert.equal(a, attachExtension)
          return commander
        }
      }
      attachExtension.cmd(commander)
    })

    beforeEach(() => {
      process.env.USER_PATH = userSettingsFolder
      const appId = 'foobarTest'

      process.env.APP_PATH = appPath
      const appSettings = new AppSettings()
      mkdirp.sync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
      appSettings.setId(appId).setAttachedExtensions({}).save().init()
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

    it('should throw if user not logged in', () => {
      UserSettings.getInstance().getSession().token = null
      try {
        attachExtension()
      } catch (err) {
        assert.equal(err.message, 'not logged in')
      }
    })

    it('should attach if extension exists locally', () => {
      const name = 'existentExtension'

      const extPath = path.join('extensions', name)
      fsEx.ensureDirSync(extPath)
      fsEx.writeJSONSync(path.join(extPath, 'settings.json'), {id: 'existentExtension'})

      attachExtension([name])
      assert.deepEqual(AppSettings.getInstance().attachedExtensions[name], {id: 'existentExtension'})
    })

    it('should throw an error if extension does not exist locally', () => {
      const name = 'notExitstentExtension'

      try {
        attachExtension([name])
      } catch (e) {
        assert.equal(e.message, `Extension '${name}' does not exist locally`)
      }
    })

    it('should throw an error if extension-config is invalid', () => {
      const name = 'existentExtension'

      const extPath = path.join('extensions', name)
      fsEx.ensureDirSync(extPath)
      fsEx.writeJSONSync(path.join(extPath, 'settings.json'), {})

      try {
        attachExtension([name])
      } catch (e) {
        assert.equal(e.message, `Config file of '${name}' is invalid`)
      }

      assert.deepEqual(AppSettings.getInstance().attachedExtensions, {})
    })

    it('should throw an error if extension is already attached', () => {
      const name = 'existentExtension'

      const extPath = path.join('extensions', name)
      fsEx.ensureDirSync(extPath)
      fsEx.writeJSONSync(path.join(extPath, 'settings.json'), {id: name})

      try {
        attachExtension([name])
        attachExtension([name])
      } catch (e) {
        assert.equal(e.message, `Extension '${name} is already attached`)
      }
    })

    it('should add all local extensions if none are specified', () => {
      const names = ['extension1', 'extension2']

      names.forEach(name => {
        const extPath = path.join('extensions', name)
        fsEx.ensureDirSync(extPath)
        fsEx.writeJSONSync(path.join(extPath, 'settings.json'), {id: name})
      })

      attachExtension([])
      assert.equal(Object.keys(AppSettings.getInstance().attachedExtensions).length, 2)
    })
  })
})
