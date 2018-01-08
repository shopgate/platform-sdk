const assert = require('assert')
const proxyquire = require('proxyquire')
const path = require('path')
const fsEx = require('fs-extra')
const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')

const appPath = path.join('build', 'appsettings')
const userPath = path.join('build', 'usersettings')

describe('FrontendAction', () => {
  let frontendAction
  const FrontendAction = proxyquire('../../lib/actions/FrontendAction', {
    '../logger': {
      info: () => {},
      error: () => {},
      debug: () => {}
    }
  })

  beforeEach(() => {
    frontendAction = new FrontendAction()
    process.env.USER_PATH = userPath
    fsEx.emptyDirSync(userPath)
    new UserSettings().setToken({})
    process.env.APP_PATH = appPath
    fsEx.emptyDirSync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    new AppSettings().setId('foobarTest')
  })

  afterEach(() => {
    delete process.env.APP_PATH
    delete process.env.USER_PATH
  })

  describe('themeChanged()', () => {
    it('should work', (done) => {
      let generated = { frontend: {id: 'myGeneratedTheme'} }
      const dcClient = {
        generateExtensionConfig: (config, appId, cb) => {
          cb(null, generated)
        }
      }

      frontendAction.appSettings = {
        getId: () => 'appId'
      }

      const cfgPath = path.join(process.env.APP_PATH, 'extension', 'testExt')
      frontendAction.themeChanged(dcClient, { file: generated, path: cfgPath }, (err) => {
        assert.ifError(err)
        let cfg = fsEx.readJsonSync(path.join(cfgPath, 'config', 'app.json'))
        assert.deepEqual(cfg, {id: 'myGeneratedTheme'})
        done()
      })
    })
  })
})
