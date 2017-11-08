const AppSettings = require('../../lib/app/AppSettings')
const assert = require('assert')
const rimraf = require('rimraf')
const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')

describe('AppSettings', () => {
  let testFolder

  beforeEach(() => {
    testFolder = path.join('test', 'appsettings')
    process.env.APP_PATH = testFolder
  })

  afterEach((done) => {
    delete process.env.APP_PATH
    rimraf(testFolder, done)
  })

  it('should have default settingsFolder', () => {
    delete process.env.APP_PATH
    assert.ok(new AppSettings().settingsFolder.includes('.sgcloud'))
  })

  it('should throw if application data is invalid', (done) => {
    const appSettings = new AppSettings()
    mkdirp.sync(appSettings.settingsFolder)
    fs.writeFileSync(appSettings.settingsFile, JSON.stringify({}))
    fs.writeFileSync(appSettings.attachedExtensionsFile, JSON.stringify({}))
    try {
      appSettings.init()
    } catch (err) {
      assert.equal(err.message, 'application data invalid')
      done()
    }
  })
})
