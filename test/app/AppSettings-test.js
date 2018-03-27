const AppSettings = require('../../lib/app/AppSettings')
const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const mockFs = require('mock-fs')

describe('AppSettings', () => {
  let testFolder

  before(done => {
    mockFs()
    done()
  })

  after(done => {
    mockFs.restore()
    done()
  })

  beforeEach(() => {
    testFolder = path.join('build', 'appsettings')
    process.env.APP_PATH = testFolder
  })

  afterEach((done) => {
    delete process.env.APP_PATH
    fsEx.remove(testFolder, done)
  })

  it('should throw an error if application data does not exist', async () => {
    const appSettings = new AppSettings(testFolder)
    fsEx.emptyDirSync(appSettings.settingsFolder)
    try {
      await appSettings.validate()
      assert.fail('Expected error to be thrown.')
    } catch (err) {
      assert.equal(err.message, 'The current folder seems not to be a sgcloud project. Please run sgcloud init first.')
    }
  })

  it('should throw if application data is invalid', async () => {
    const appSettings = new AppSettings(testFolder)
    fsEx.emptyDirSync(appSettings.settingsFolder)
    fsEx.writeJsonSync(appSettings.settingsFile, {})
    fsEx.writeJsonSync(appSettings.attachedExtensionsFile, {})
    try {
      await appSettings.validate()
      assert.fail('Expected error to be thrown.')
    } catch (err) {
      assert.equal(err.message, 'The current folder seems not to be a sgcloud project. Please run sgcloud init first.')
    }
  })
})
