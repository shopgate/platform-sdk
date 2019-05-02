const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const AppSettings = require('../../lib/app/AppSettings')

describe('AppSettings', () => {
  let testFolder

  beforeEach(async () => {
    testFolder = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    process.env.APP_PATH = testFolder
  })

  afterEach(async () => {
    delete process.env.APP_PATH
    await fsEx.remove(testFolder)
  })

  it('should throw an error if application data does not exist', async () => {
    const appSettings = new AppSettings(testFolder)
    fsEx.emptyDirSync(appSettings.settingsFolder)
    try {
      await appSettings.validate()
      assert.fail('Expected error to be thrown.')
    } catch (err) {
      assert.equal(err.message, 'The current directory seems not to be an sgconnect project. Please run sgconnect init first.')
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
      assert.equal(err.message, 'The current directory seems not to be an sgconnect project. Please run sgconnect init first.')
    }
  })
})
