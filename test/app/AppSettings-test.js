const AppSettings = require('../../lib/app/AppSettings')
const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')

describe('AppSettings', () => {
  let testFolder

  beforeEach(() => {
    testFolder = path.join('build', 'appsettings')
    process.env.APP_PATH = testFolder
  })

  afterEach((done) => {
    delete process.env.APP_PATH
    fsEx.remove(testFolder, done)
  })

  it('should have default settingsFolder', () => {
    delete process.env.APP_PATH
    assert.ok(new AppSettings().settingsFolder.includes('.sgcloud'))
  })

  it('should throw if application data are not exist', (done) => {
    const appSettings = new AppSettings()
    fsEx.emptyDirSync(appSettings.settingsFolder)
    try {
      appSettings.init()
    } catch (err) {
      assert.equal(err.message, 'This current folder does not contain any application data. Please run `sgcloud init` first.')
      done()
    }
  })

  it('should throw if application data is invalid', (done) => {
    const appSettings = new AppSettings()
    fsEx.emptyDirSync(appSettings.settingsFolder)
    fsEx.writeJsonSync(appSettings.settingsFile, {})
    fsEx.writeJsonSync(appSettings.attachedExtensionsFile, {})
    try {
      appSettings.init()
    } catch (err) {
      assert.equal(err.message, 'application data invalid')
      done()
    }
  })
})
