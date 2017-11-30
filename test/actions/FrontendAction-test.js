const assert = require('assert')
const proxyquire = require('proxyquire')
const path = require('path')
const fsEx = require('fs-extra')
const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')

const appPath = path.join('build', 'appsettings')

describe('FrontendAction', () => {
  let frontendAction
  const FrontendAction = proxyquire('../../lib/actions/FrontendAction', {
    '../logger': {
      info: () => {},
      error: () => {},
      debug: () => {}
    }
  })

  beforeEach((done) => {
    frontendAction = new FrontendAction()
    UserSettings.getInstance().getSession().token = {}
    process.env.APP_PATH = appPath
    const appSettings = new AppSettings()
    fsEx.emptyDirSync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    appSettings.setId('foobarTest').setAttachedExtensions({}).save()

    appSettings.init()
    AppSettings.setInstance(appSettings)
    done()
  })

  afterEach((done) => {
    UserSettings.setInstance()
    AppSettings.setInstance()
    delete process.env.APP_PATH

    done()
  })

  describe('themeChanged()', () => {
    it('should work', (done) => {
      let generated = { frontend: {id: 'myGeneratedTheme'} }
      const dcClient = {
        generateExtensionConfig: (config, appId, cb) => {
          cb(null, generated)
        }
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
