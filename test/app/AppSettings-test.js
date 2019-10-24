const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const AppSettings = require('../../lib/app/AppSettings')
const { EXTENSIONS_FOLDER } = require('../../lib/app/Constants')

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

  it('should validate and update attached extensions file', async () => {
    const appSettings = new AppSettings(testFolder)
    const extensionsDir = path.join(appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
    fsEx.emptyDirSync(appSettings.settingsFolder)
    fsEx.writeJsonSync(appSettings.attachedExtensionsFile, {})

    // Attaching extensions
    // extension-1's path is `extension-1`
    // extension-2's trusted flag is `true`
    await appSettings.attachExtension('extension-1', { id: '@shopgate/extension-1', trusted: false })
    await appSettings.attachExtension('extension-two', { id: '@shopgate/extension-2', trusted: true })

    fsEx.emptyDirSync(extensionsDir)
    fsEx.emptyDirSync(path.join(extensionsDir, 'extension-one'))
    fsEx.emptyDirSync(path.join(extensionsDir, 'extension-two'))
    fsEx.writeJsonSync(path.join(extensionsDir, 'extension-one', 'extension-config.json'), { id: '@shopgate/extension-1', version: '1.0.0' })
    fsEx.writeJsonSync(path.join(extensionsDir, 'extension-two', 'extension-config.json'), { id: '@shopgate/extension-2', version: '1.0.0', trusted: false })

    await appSettings.validateAttachedExtensions()
    const after = await appSettings.loadAttachedExtensions()

    // Attached extensions changed
    // extension-1's path is now `extension-one`
    // extension-2's trusted flag is false now
    assert.deepStrictEqual(after, {
      '@shopgate/extension-1': { path: 'extension-one', trusted: false },
      '@shopgate/extension-2': { path: 'extension-two', trusted: false }
    })
  })
})
