const assert = require('assert')
const path = require('path')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const fsEx = require('fs-extra')

const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')
const ExtensionAction = require('../../lib/actions/ExtensionAction')

const userSettingsFolder = path.join('test', 'usersettings')
const appPath = path.join('test', 'appsettings')

describe('ExtensionAction', () => {
  const action = new ExtensionAction()

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

  describe('general', () => {
    it('should throw if user not logged in', () => {
      UserSettings.getInstance().getSession().token = null
      try {
        action.run('attach')
      } catch (err) {
        assert.equal(err.message, 'not logged in')
      }
    })

    it('should throw if invalid action is given', () => {
      try {
        action.run('invalid')
      } catch (err) {
        assert.equal(err.message, 'unknown action "invalid"')
      }
    })
  })

  describe('attaching', () => {
    it('should attach if extension exists locally', () => {
      const name = 'existentExtension'

      const extPath = path.join('extensions', name)
      fsEx.ensureDirSync(extPath)
      fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {id: 'existentExtension'})

      action.run('attach', [name])
      assert.deepEqual(AppSettings.getInstance().attachedExtensions[name], {id: 'existentExtension'})
    })

    it('should attach all local extensions if no one is given', () => {
      const name1 = 'existentExtension1'
      const name2 = 'existentExtension2'

      const extPath1 = path.join('extensions', name1)
      const extPath2 = path.join('extensions', name2)
      fsEx.ensureDirSync(extPath1)
      fsEx.ensureDirSync(extPath2)
      fsEx.writeJSONSync(path.join(extPath1, 'extension-config.json'), {id: 'existentExtension1'})
      fsEx.writeJSONSync(path.join(extPath2, 'extension-config.json'), {id: 'existentExtension2'})

      action.run('attach', [name1])
      action.run('attach')

      assert.deepEqual(AppSettings.getInstance().attachedExtensions, {
        existentExtension1: { id: 'existentExtension1' },
        existentExtension2: { id: 'existentExtension2' }
      })
    })

    it('should throw an error if extension does not exist locally', () => {
      const name = 'notExitstentExtension'

      try {
        action.run('attach', [name])
      } catch (e) {
        assert.equal(e.message, `Extension '${name}' does not exist locally`)
      }
    })

    it('should throw an error if extension-config is invalid', () => {
      const name = 'existentExtension'

      const extPath = path.join('extensions', name)
      fsEx.ensureDirSync(extPath)
      fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {})

      try {
        action.run('attach', [name])
      } catch (e) {
        assert.equal(e.message, `Config file of '${name}' is invalid`)
      }

      assert.deepEqual(AppSettings.getInstance().attachedExtensions, {})
    })

    it('should throw an error if extension is already attached', () => {
      const name = 'existentExtension'

      const extPath = path.join('extensions', name)
      fsEx.ensureDirSync(extPath)
      fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {id: name})

      action.run('attach', [name])
      try {
        action.run('attach', [name])
      } catch (e) {
        assert.equal(e.message, `Extension '${name} is already attached`)
      }
    })
  })

  describe('detaching', () => {
    it('should detach a extension', () => {
      const name = 'existentExtension'

      AppSettings.getInstance().attachExtension(name)
      action.run('detach', [name])
      assert.deepEqual(AppSettings.getInstance().attachedExtensions, {})
    })

    it('should skip if extension was not attached', (done) => {
      const name = 'notExitstentExtension'

      console.warn = (text) => {
        assert.equal(text, `The extension '${name}' is not attached`)
        done()
      }

      action.run('detach', [name])
    })

    it('should detach all extensions if none was specified', () => {
      AppSettings.getInstance().attachExtension('ext1')
      AppSettings.getInstance().attachExtension('ext2')

      action.run('detach')
      assert.deepEqual(AppSettings.getInstance().attachedExtensions, {})
    })
  })
})
