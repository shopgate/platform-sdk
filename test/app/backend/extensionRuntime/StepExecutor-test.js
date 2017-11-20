const assert = require('assert')
const path = require('path')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const fs = require('fs-extra')

const StepExecutor = require('../../../../lib/app/backend/extensionRuntime/StepExecutor')
const AppSettings = require('../../../../lib/app/AppSettings')
const UserSettings = require('../../../../lib/user/UserSettings')
const appPath = path.join('test', 'appsettings')

describe('StepExecutor', () => {
  let executor
  let log
  let appTestFolder

  before((done) => {
    appTestFolder = path.join('test', 'appsettings')
    process.env.SGCLOUD_DC_WS_ADDRESS = `http://nockedDc`
    process.env.APP_PATH = appTestFolder
    log = {info: () => {}, error: console.error, debug: () => {}}
    executor = new StepExecutor(log)
    const appSettings = new AppSettings()
    mkdirp.sync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    mkdirp.sync(path.join(appPath, AppSettings.EXTENSIONS_FOLDER, 'foobar', 'extension'))
    appSettings.setId('shop_10006').setAttachedExtensions({'@foo/bar': {path: 'foobar'}}).save().init()
    AppSettings.setInstance(appSettings)
    UserSettings.getInstance().getSession().token = {}

    const fakeStepDir = path.join(__dirname, 'fakeSteps')
    const extensionDir = path.join(appPath, AppSettings.EXTENSIONS_FOLDER, 'foobar', 'extension')
    fs.copySync(path.join(fakeStepDir, 'simple.js'), path.join(extensionDir, 'simple.js'))

    executor.start()
    done()
  })

  after((done) => {
    delete process.env.SGCLOUD_DC_WS_ADDRESS
    delete process.env.APP_PATH
    executor.stop()
    rimraf(appTestFolder, done)
  })

  it('should call a local step action', (done) => {
    const input = {foo: 'bar'}
    const stepMeta = {
      id: '@foo/bar',
      path: '@foo/bar/simple.js',
      meta: {appId: 'shop_123'}
    }
    executor.execute(input, stepMeta, (err, output) => {
      assert.ifError(err)
      assert.deepEqual(output, input)
      done()
    })
  })

  it('should fail if step file is not existent', (done) => {
    const input = {foo: 'bar'}
    const stepMeta = {
      id: '@foo/bar',
      path: '@foo/bar/notThere.js',
      meta: {appId: 'shop_123'}
    }
    executor.execute(input, stepMeta, (err) => {
      assert.ok(err)
      assert.ok(err.message.endsWith('/appsettings/extensions/foobar/extension/notThere.js" not found'))
      done()
    })
  })
})
