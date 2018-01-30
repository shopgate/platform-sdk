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

  it('should throw an error if application data does not exist', (done) => {
    const appSettings = new AppSettings(testFolder)
    fsEx.emptyDirSync(appSettings.settingsFolder)
    try {
      appSettings.validate()
    } catch (err) {
      assert.equal(err.message, 'The current folder seems not to be a sgcloud project. Please run sgcloud init first.')
      done()
    }
  })

  it('should throw if application data is invalid', (done) => {
    const appSettings = new AppSettings(testFolder)
    fsEx.emptyDirSync(appSettings.settingsFolder)
    fsEx.writeJsonSync(appSettings.settingsFile, {})
    fsEx.writeJsonSync(appSettings.attachedExtensionsFile, {})
    try {
      appSettings.validate()
    } catch (err) {
      assert.equal(err.message, 'The current folder seems not to be a sgcloud project. Please run sgcloud init first.')
      done()
    }
  })
})
