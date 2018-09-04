const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const EventStream = require('stream').Writable
const sinon = require('sinon')
const nock = require('nock')
const mockFs = require('mock-fs')
const proxyquire = require('proxyquire')
const inquirer = require('inquirer')
const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')
const DcHttpClient = require('../../lib/DcHttpClient')
const { EXTENSIONS_FOLDER } = require('../../lib/app/Constants')
const logger = require('../../lib/logger')

let callbacks = {}

class Extract extends EventStream {
  constructor () {
    super()
    return () => {
      callbacks = {}
      return {
        on: this.on,
        error: this.error,
        _write: this._write,
        end: this.end,
        removeListener: () => (true),
        emit: (what) => (this.emit(what))
      }
    }
  }
  _write () {}
  on (event, callback) {
    if (!callbacks[event]) callbacks[event] = []
    callbacks[event].push(callback)
  }
  _transform () { }
  error () {}
  end () {}
}

const extract = new Extract()
const unzip = {
  Extract: extract
}
const ExtensionAction = proxyquire('../../lib/actions/ExtensionAction', {
  'unzip': unzip,
  'child_process': {
    spawn: () => (mockProcess)
  }
})
let spawnEventCallback = { code: 0, signal: 'none' }
const mockProcess = {
  on: (event, callback) => {
    callback(spawnEventCallback.code, spawnEventCallback.signal)
  }
}

const userSettingsFolder = path.join('build', 'usersettings')
const appPath = path.join('build', 'appsettings')

describe('ExtensionAction', () => {
  const SGCLOUD_DC_ADDRESS = 'http://dc.shopgate.cloud'
  let subjectUnderTest
  let userSettings
  let appSettings
  let dcHttpClient

  beforeEach(async () => {
    process.env.USER_PATH = userSettingsFolder
    process.env.SGCLOUD_DC_ADDRESS = SGCLOUD_DC_ADDRESS
    mockFs()
    appSettings = new AppSettings(appPath)
    appSettings.getId = async () => ('shop_123')
    userSettings = await new UserSettings().setToken('TEST_TOKEN')
    dcHttpClient = new DcHttpClient(userSettings, null)
    subjectUnderTest = new ExtensionAction(appSettings, userSettings, dcHttpClient)
  })

  afterEach(async () => {
    delete process.env.USER_PATH
    delete process.env.APP_PATH
  })

  describe('general', () => {
    it('should register', () => {
      const caporal = {}
      caporal.command = sinon.stub().returns(caporal)
      caporal.description = sinon.stub().returns(caporal)
      caporal.argument = sinon.stub().returns(caporal)
      caporal.action = async (cb) => {
        await cb()
        return caporal
      }
      caporal.option = sinon.stub().returns(caporal)

      subjectUnderTest.run = async () => (true)

      ExtensionAction.build = () => ({
        attachExtensions: async () => (true),
        createExtension: async () => (true),
        detachExtensions: async () => (true),
        manageExtensions: async () => (true),
        uploadExtension: async () => (true)
      })
      ExtensionAction.register(caporal)

      assert(caporal.command.calledWith('extension create'))
      assert(caporal.command.calledWith('extension attach'))
      assert(caporal.command.calledWith('extension detach'))
      assert(caporal.command.calledWith('extension manage'))
      assert(caporal.command.calledWith('extension upload'))
      assert(caporal.command.calledWith('theme upload'))
    })
    it('should throw if user not logged in', async () => {
      await userSettings.setToken(null)
      try {
        await subjectUnderTest.attachExtensions({ extensions: [] })
        assert.fail('Expected error to be thrown.')
      } catch (err) {
        assert.equal(err.message, 'You\'re not logged in! Please run `sgconnect login` again.')
      }
    })
  })

  describe('attaching and detaching', () => {
    it('should attach if extension exists locally', async () => {
      const name = 'existentExtension'
      const id = 'extId'

      const extPath = path.join(appPath, 'extensions', name)
      await fsEx.ensureDir(extPath)
      await fsEx.writeJSON(path.join(extPath, 'extension-config.json'), { id, trusted: false })

      await subjectUnderTest.attachExtensions({ extensions: [name] })

      const config = await fsEx.readJson(appSettings.attachedExtensionsFile)
      assert.deepEqual(config.attachedExtensions[id], { path: name, trusted: false })
    })

    it('should attach all local extensions if no one is given', async () => {
      const name1 = 'existentExtension1'
      const name2 = 'existentExtension2'

      const extPath1 = path.join(appPath, 'extensions', name1)
      const extPath2 = path.join(appPath, 'extensions', name2)
      await fsEx.ensureDir(extPath1)
      await fsEx.ensureDir(extPath2)
      await fsEx.writeJSON(path.join(extPath1, 'extension-config.json'), { id: 'existentExtension1', trusted: false })
      await fsEx.writeJSON(path.join(extPath2, 'extension-config.json'), { id: 'existentExtension2', trusted: false })

      await subjectUnderTest.attachExtensions({ extensions: [name1] })
      await subjectUnderTest.attachExtensions({})
      const config = await fsEx.readJson(appSettings.attachedExtensionsFile)
      assert.deepEqual(config.attachedExtensions, {
        existentExtension1: { path: 'existentExtension1', trusted: false },
        existentExtension2: { path: 'existentExtension2', trusted: false }
      })
    })

    it('should throw an error if extension does not exist locally', async () => {
      const name = 'notExitstentExtension'

      try {
        await subjectUnderTest.attachExtensions({ extensions: [name] })
      } catch (e) {
        assert.equal(e.message, `Config file of 'notExitstentExtension' is invalid or not existent`)
      }
    })

    it('should throw an error if extension-config is invalid', async () => {
      const name = 'existentExtension'

      const extPath = path.join(appPath, 'extensions', name)
      await fsEx.ensureDir(extPath)
      await fsEx.writeJSON(path.join(extPath, 'extension-config.json'), {})

      try {
        await subjectUnderTest.attachExtensions({ extensions: [name] })
      } catch (e) {
        assert.equal(e.message, `Config file of '${name}' is invalid or not existent`)
      }
    })

    it('should throw an error if extension is already attached', async () => {
      const name = 'existentExtension'

      const extPath = path.join(appPath, 'extensions', name)
      await fsEx.ensureDir(extPath)
      await fsEx.writeJSON(path.join(extPath, 'extension-config.json'), { id: name })

      await subjectUnderTest.attachExtensions({ extensions: [name] })
      try {
        await subjectUnderTest.attachExtensions({ extensions: [name] })
      } catch (e) {
        assert.equal(e.message, `Extension 'existentExtension (existentExtension) is already attached`)
      }
    })

    it('should throw if user not logged in', async () => {
      await userSettings.setToken(null)
      try {
        await subjectUnderTest.attachExtensions({})
      } catch (err) {
        assert.equal(err.message, 'You\'re not logged in! Please run `sgconnect login` again.')
      }
    })

    it('should detach a extension', async () => {
      const name = 'existentExtension'

      const extPath = path.join(appPath, 'extensions', name)
      await fsEx.ensureDir(extPath)
      await fsEx.writeJSON(path.join(extPath, 'extension-config.json'), { id: name })

      await appSettings.attachExtension(name, { id: name, trusted: false })
      await subjectUnderTest.detachExtensions({ extensions: [name] })

      const config = await fsEx.readJson(appSettings.attachedExtensionsFile)
      assert.deepEqual(config.attachedExtensions, {})
    })

    it('should skip if extension was not attached', async () => {
      const name = 'notExistentExtension'

      const extPath = path.join(appPath, 'extensions', name)
      await fsEx.ensureDir(extPath)
      await fsEx.writeJSON(path.join(extPath, 'extension-config.json'), { id: name })

      let warning
      logger.warn = (text) => {
        warning = text
      }

      await subjectUnderTest.detachExtensions({ extensions: [name] })

      assert.ok(warning)
      assert.equal(warning, `The extension '${name}' is not attached`)
    })

    it('should detach all extensions if none was specified', async () => {
      await appSettings.attachExtension('ext2', { id: 'ext2' })
      await appSettings.attachExtension('ext1', { id: 'ext1' })

      await subjectUnderTest.detachExtensions({})
      const config = await fsEx.readJson(appSettings.attachedExtensionsFile)
      assert.deepEqual(config.attachedExtensions, {})
    })
  })

  describe('manage extensions', () => {
    let loggerWarnStub
    let inquirerPromptStub
    let getAllExtensionPropertiesStub
    let detachExtensionsStub
    let attachExtensionsStub

    before(() => {
      loggerWarnStub = sinon.stub(logger, 'warn')
      inquirerPromptStub = sinon.stub(inquirer, 'prompt').resolves({ extensions: [] })
    })

    after(() => {
      loggerWarnStub.restore()
      inquirerPromptStub.restore()
    })

    beforeEach(() => {
      getAllExtensionPropertiesStub = sinon.stub(subjectUnderTest, '_getAllExtensionProperties').resolves([
        { id: '@acme/one', dir: 'acme-one', attached: false },
        { id: '@acme/two', dir: 'acme-two', attached: true },
        { id: '@acme/three', dir: 'acme-three', attached: false }
      ])

      detachExtensionsStub = sinon.stub(subjectUnderTest, 'detachExtensions')
      attachExtensionsStub = sinon.stub(subjectUnderTest, 'attachExtensions')
    })

    afterEach(() => {
      loggerWarnStub.reset()
      inquirerPromptStub.reset()
    })

    it('should detach an attached extension if nothing was selected within the picker', async () => {
      await subjectUnderTest.manageExtensions()

      sinon.assert.callCount(inquirerPromptStub, 1)
      sinon.assert.callCount(detachExtensionsStub, 1)
      sinon.assert.calledWithExactly(detachExtensionsStub, { extensions: ['acme-two'] })
      sinon.assert.callCount(attachExtensionsStub, 0)
    })

    it('should do nothing if the picker selection was not changed', async () => {
      inquirerPromptStub.resolves({ extensions: ['@acme/two'] })
      await subjectUnderTest.manageExtensions()

      sinon.assert.callCount(inquirerPromptStub, 1)
      sinon.assert.callCount(detachExtensionsStub, 0)
      sinon.assert.callCount(attachExtensionsStub, 0)
    })

    it('should attach and detach extionsions according to the picker selection', async () => {
      inquirerPromptStub.resolves({ extensions: ['@acme/one'] })

      detachExtensionsStub.restore()
      attachExtensionsStub.restore()
      detachExtensionsStub = sinon.spy(subjectUnderTest, 'detachExtensions')
      attachExtensionsStub = sinon.spy(subjectUnderTest, 'attachExtensions')

      const name1 = '@acme/one'
      const name2 = '@acme/two'
      const name3 = '@acme/three'

      const extPath1 = path.join(appPath, 'extensions', 'acme-one')
      const extPath2 = path.join(appPath, 'extensions', 'acme-two')
      const extPath3 = path.join(appPath, 'extensions', 'acme-three')

      await fsEx.ensureDir(extPath1)
      await fsEx.ensureDir(extPath2)
      await fsEx.ensureDir(extPath3)

      await fsEx.writeJSON(path.join(extPath1, 'extension-config.json'), { id: name1, trusted: false })
      await fsEx.writeJSON(path.join(extPath2, 'extension-config.json'), { id: name2, trusted: false })
      await fsEx.writeJSON(path.join(extPath3, 'extension-config.json'), { id: name3, trusted: false })

      await subjectUnderTest.manageExtensions()

      sinon.assert.callCount(inquirerPromptStub, 1)
      sinon.assert.callCount(detachExtensionsStub, 1)
      sinon.assert.calledWithExactly(detachExtensionsStub, { extensions: ['acme-two'] })
      sinon.assert.callCount(attachExtensionsStub, 1)
      sinon.assert.calledWithExactly(attachExtensionsStub, { extensions: ['acme-one'] })

      const config = await fsEx.readJson(appSettings.attachedExtensionsFile)
      assert.deepEqual(config.attachedExtensions, {
        '@acme/one': { path: 'acme-one', trusted: false }
      })
    })

    it('should log a warning when no extensions are available to pick', async () => {
      getAllExtensionPropertiesStub.returns([])
      await subjectUnderTest.manageExtensions()

      sinon.assert.callCount(loggerWarnStub, 1)
      sinon.assert.callCount(inquirerPromptStub, 0)
      sinon.assert.callCount(detachExtensionsStub, 0)
      sinon.assert.callCount(attachExtensionsStub, 0)
    })
  })

  describe('._getAllExtensionProperties()', () => {
    let attachedExtensionsFile
    let extensionsFolder
    let mockedFs

    after(() => {
      mockFs.restore()
    })

    beforeEach(() => {
      attachedExtensionsFile = subjectUnderTest.appSettings.attachedExtensionsFile
      extensionsFolder = path.join(subjectUnderTest.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
      // Populate the mocked fs structure to enable updates of single properties during tests
      mockedFs = {
        [extensionsFolder]: {
          'acme-one': { 'extension-config.json': '{"id": "@acme/one"}' },
          'acme-two': { 'extension-config.json': '{"id": "@acme/two"}' },
          'empty': {}
        },
        [attachedExtensionsFile]: '{"attachedExtensions":{"@acme/two":{"path":"acme-two"}}}'
      }

      mockFs(mockedFs)
    })

    it('should return the summary with one attached extension', async () => {
      const expected = [
        { id: '@acme/one', dir: 'acme-one', attached: false },
        { id: '@acme/two', dir: 'acme-two', attached: true }
      ]

      const result = await subjectUnderTest._getAllExtensionProperties()
      assert.deepEqual(result, expected)
    })

    it('should return the summary with no attached extension', async () => {
      // Clear the attached extensions for this test
      mockedFs[attachedExtensionsFile] = '{"attachedExtensions":{}}'
      mockFs(mockedFs)

      const expected = [
        { id: '@acme/one', dir: 'acme-one', attached: false },
        { id: '@acme/two', dir: 'acme-two', attached: false }
      ]

      const result = await subjectUnderTest._getAllExtensionProperties()
      assert.deepEqual(result, expected)
    })

    it('should return an empty array if no extensions are available', async () => {
      // Clear the extensions for this test
      mockedFs[extensionsFolder] = null
      mockFs(mockedFs)

      const result = await subjectUnderTest._getAllExtensionProperties()
      assert.deepEqual(result, [])
    })
  })

  describe('extension create', () => {
    const extensionFolder = path.join('build', 'extensions')

    beforeEach((done) => {
      nock.disableNetConnect()
      done()
    })

    afterEach((done) => {
      nock.enableNetConnect()
      done()
    })

    describe('general', () => {
      it('should create an extension', async () => {
        subjectUnderTest._getUserInput = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        subjectUnderTest._checkIfExtensionExists = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        subjectUnderTest._downloadBoilerplate = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        subjectUnderTest._renameBoilerplate = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        subjectUnderTest._removeUnusedDirs = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        subjectUnderTest._removePlaceholders = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        subjectUnderTest._updateBackendFiles = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        subjectUnderTest._installFrontendDependencies = () => { return new Promise((resolve, reject) => { resolve({}) }) }

        await subjectUnderTest.createExtension({ types: [] }, null)
      })

      it('should catch an error because of sth.', async () => {
        subjectUnderTest._getUserInput = () => { return new Promise((resolve, reject) => { resolve() }) }
        subjectUnderTest._checkIfExtensionExists = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        subjectUnderTest._downloadBoilerplate = (extensionsFolder, state) => {
          state.cloned = true
          return new Promise((resolve, reject) => {
            reject(new Error('error'))
          })
        }
        subjectUnderTest._cleanUp = (state) => assert.ok(state.cloned)

        await subjectUnderTest.createExtension({}, null)
      })

      it('should throw error "not logged in"', async () => {
        await userSettings.setToken(null)

        try {
          await subjectUnderTest.createExtension({}, null)
          assert.fail('Expected error to be thrown.')
        } catch (err) {
          assert.equal(err.message, 'You\'re not logged in! Please run `sgconnect login` again.')
        }
      })
    })

    describe('_getUserInput', () => {
      it('should get the user input by command', () => {
        const options = {
          extension: '@o1/e1',
          trusted: false
        }
        const types = ['backend', 'frontend']

        const externalUserInput = {}
        const expected = {
          extensionName: '@o1/e1',
          organizationName: 'o1',
          trusted: false,
          toBeCreated: { frontend: true, backend: true }
        }

        subjectUnderTest
          ._getUserInput(options, types, externalUserInput)
          .then(() => {
            assert.deepEqual(externalUserInput, expected)
          })
      })
    })

    describe('_checkIfExtensionExists', () => {
      let tempFolder
      let folderPath
      beforeEach(() => {
        tempFolder = fsEx.mkdtempSync('checkIfExtensionExists')
        folderPath = path.join(tempFolder, EXTENSIONS_FOLDER, 'testExtension')
        fsEx.ensureDirSync(folderPath)
      })

      afterEach(() => {
        fsEx.removeSync(tempFolder)
      })

      it('should get the user input by command', () => {
        subjectUnderTest.appSettings = { getApplicationFolder: () => tempFolder }

        return subjectUnderTest._checkIfExtensionExists('testExtension')
          .then(() => {
            assert.fail('Should not be called')
          })
          .catch((err) => {
            assert.equal(err.message, 'The extension \'testExtension\' already exists')
          })
      })
    })

    describe('_downloadBoilerplate', () => {
      it('should download and unzip the boilerplate', (done) => {
        const state = {}
        mockFs.restore()
        const n = nock('https://data.shopgate.com')
          .get('/connect/platform-sdk/latest.zip')
          .replyWithFile(200, path.join('test', 'testfiles', 'cloud-sdk-boilerplate-extension.zip'), { 'Content-Type': 'application/zip' })

        setTimeout(() => {
          callbacks['close'][0]()
        }, 500)

        subjectUnderTest
          ._downloadBoilerplate(extensionFolder, state)
          .then(() => {
            mockFs()
            assert.ok(state.cloned)
            n.done()
            done()
          })
      })

      it('should download beta of the boilerplate if pkg is beta', (done) => {
        const state = {}
        mockFs.restore()
        const n = nock('https://data.shopgate.com')
          .get('/connect/platform-sdk/beta.zip')
          .replyWithFile(200, path.join('test', 'testfiles', 'cloud-sdk-boilerplate-extension.zip'), { 'Content-Type': 'application/zip' })

        process.env['SDK_BETA'] = true
        setTimeout(() => {
          callbacks['close'][0]()
        }, 500)

        subjectUnderTest
          ._downloadBoilerplate(extensionFolder, state)
          .then(() => {
            delete process.env['SDK_BETA']
            mockFs()
            assert.ok(state.cloned)
            n.done()
            done()
          })
      })

      it('should download custom boilerplate if set via env', async function () {
        const state = {}
        mockFs.restore()
        const n = nock('https://data.random.org')
          .get('/some.zip')
          .replyWithFile(200, path.join('test', 'testfiles', 'cloud-sdk-boilerplate-extension.zip'), { 'Content-Type': 'application/zip' })

        process.env['BOILERPLATE_URL'] = 'https://data.random.org/some.zip'
        setTimeout(() => {
          callbacks['close'][0]()
        }, 500)

        try {
          await subjectUnderTest._downloadBoilerplate(extensionFolder, state)
          delete process.env['BOILERPLATE_URL']
          mockFs()
          assert.ok(state.cloned)
          n.done()
        } catch (err) {
          assert.ifError(err)
        }
      })

      it('should fail because of error while loading or unzipping', (done) => {
        const state = {}
        const n = nock('https://data.shopgate.com')
          .get('/connect/platform-sdk/latest.zip')
          .reply(404, { error: 'error' })

        setTimeout(() => {
          callbacks['error'][0]({ message: '' })
        }, 500)

        subjectUnderTest
          ._downloadBoilerplate(extensionFolder, state)
          .then(data => {
            done()
          })
          .catch((err) => {
            assert.ok(err.message.startsWith('Error while downloading boilerplate'))
            n.done()
            done()
          })
      })
    })

    describe('_renameBoilerplate', () => {
      const oldName = 'foo'
      const newName = 'bar'

      const userInput = { extensionName: newName }
      const defaultPath = path.join(extensionFolder, oldName)
      const state = {}

      it('should rename the boilerplate dir', () => {
        fsEx.ensureDirSync(path.join(extensionFolder, oldName))

        return subjectUnderTest
          ._renameBoilerplate(userInput, defaultPath, extensionFolder, state)
          .then(() => {
            const newPath = path.join(extensionFolder, 'bar')
            assert.equal(state.extensionPath, newPath)
            assert.ok(state.moved)
            assert.ok(fsEx.existsSync(newPath))
          })
      })

      it('should fail because moving failed', () => {
        fsEx.ensureDirSync(path.join(extensionFolder, oldName))
        fsEx.ensureDirSync(path.join(extensionFolder, newName, 'test'))

        return subjectUnderTest
          ._renameBoilerplate(userInput, defaultPath, extensionFolder, state)
          .then(() => {
            assert.fail('It should fail')
          }).catch((err) => {
            assert.ok(
              (err.message.indexOf('EEXIST') !== -1) ||
              (err.message.indexOf('ENOTEMPTY') !== -1)
            )
          })
      })
    })

    describe('_removeUnusedDirs', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')

      it('should remove the unused dirs', () => {
        const userInput = {
          toBeCreated: {
            backend: false,
            frontend: false
          }
        }

        const state = { extensionPath }

        const dirs = [
          path.join(extensionPath, 'frontend'),
          path.join(extensionPath, 'extension'),
          path.join(extensionPath, 'pipelines')
        ]

        dirs.forEach((dir) => fsEx.ensureDirSync(dir))

        return subjectUnderTest
          ._removeUnusedDirs(userInput, state)
          .then(() => {
            dirs.forEach((dir) => assert.ok(!fsEx.existsSync(dir)))
          })
      })
    })

    describe('removePlaceHolders', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')

      beforeEach((done) => {
        fsEx.ensureDirSync(extensionPath)
        done()
      })

      afterEach((done) => {
        fsEx.removeSync(extensionFolder)
        done()
      })

      it('should remove all occurences of /@awesomeOrganization/awesomeExtension and /awesomeOrganization/', () => {
        const userInput = {
          extensionName: '@o1/e1',
          organizationName: 'o1'
        }

        const state = { extensionPath }

        const files = [
          path.join(extensionPath, 'sth.json')
        ]

        const currentFileContent = {
          extensionId: '@awesomeOrganization/awesomeExtension',
          pipelineId: 'awesomeOrganization.somePipeline'
        }
        files.forEach((file) => fsEx.writeJsonSync(file, currentFileContent))

        return subjectUnderTest
          ._removePlaceholders(userInput, state)
          .then(() => {
            const expectedFileContent = { extensionId: '@o1/e1', pipelineId: 'o1.somePipeline' }
            files.forEach((file) => assert.deepEqual(fsEx.readJsonSync(file), expectedFileContent))
          })
      })

      it('should catch the "No files match the pattern" error', () => {
        const userInput = {
          extensionName: '@o1/e1'
        }

        const state = { extensionPath }

        const file = path.join(extensionPath, 'sth.jsx')
        fsEx.writeJsonSync(file, { awesomeExtension: 'awesomeOrganization' })

        return subjectUnderTest
          ._removePlaceholders(userInput, state)
          .then(() => {
            assert.deepEqual(fsEx.readJsonSync(file), { awesomeExtension: 'awesomeOrganization' })
          })
      })
    })

    describe('updateBackendFiles', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')

      beforeEach((done) => {
        fsEx.ensureDirSync(extensionPath)
        done()
      })

      afterEach((done) => {
        fsEx.removeSync(extensionFolder)
        done()
      })

      it('should update/rename backend files', () => {
        const userInput = {
          trusted: true,
          organizationName: 'o1',
          toBeCreated: {
            backend: true
          }
        }
        const state = { extensionPath }

        const pipelineDir = path.join(extensionPath, 'pipelines')
        fsEx.ensureDirSync(pipelineDir)
        fsEx.writeJSON(path.join(pipelineDir, 'awesomeOrganization.awesomePipeline.v1.json'), {})

        const exConfFile = path.join(extensionPath, 'extension-config.json')
        fsEx.writeJSON(exConfFile, {})

        return subjectUnderTest
          ._updateBackendFiles(userInput, state)
          .then(() => {
            assert.ok(fsEx.exists(path.join(extensionPath, 'pipelines', 'o1.awesomePipeline.json')))
            assert.deepEqual(fsEx.readJsonSync(exConfFile), { trusted: true })
          })
      })

      it('should return early because the function has nothing to do', () => {
        assert.doesNotThrow(() => subjectUnderTest._updateBackendFiles({ toBeCreated: {} }, {}))
      })
    })

    describe('installFrontendDependencies', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')
      const frontendPath = path.join(extensionPath, 'frontend')

      beforeEach((done) => {
        fsEx.ensureDirSync(frontendPath)
        done()
      })

      afterEach((done) => {
        fsEx.removeSync(frontendPath)
        done()
      })

      it('should install the frontend dependencies', () => {
        const state = { extensionPath }
        const userInput = {
          toBeCreated: {
            frontend: true
          }
        }

        fsEx.writeJsonSync(path.join(frontendPath, 'package.json'), {})

        // just do sth.
        const c = {
          command: /^win/.test(process.platform) ? 'npm.cmd' : 'npm',
          params: ['-v']
        }

        return subjectUnderTest
          ._installFrontendDependencies(userInput, state, c)
      })

      it('should return early because the function has nothing to do', () => {
        assert.doesNotThrow(() => subjectUnderTest._installFrontendDependencies({ toBeCreated: {} }, {}, {}))
      })

      it('should fail because the command failed', (done) => {
        const state = { extensionPath }
        const userInput = {
          toBeCreated: {
            frontend: true
          }
        }

        fsEx.writeJsonSync(path.join(frontendPath, 'package.json'), {})

        const c = {
          command: /^win/.test(process.platform) ? 'npm.cmd' : 'npm',
          params: ['i', 'nonExistentPackage']
        }

        spawnEventCallback.code = 1

        subjectUnderTest
          ._installFrontendDependencies(userInput, state, c)
          .then(() => {
            assert.fail('Expected an exception to be thrown.')
          })
          .catch((err) => {
            assert.ok(err.message.startsWith('Install process exited with code'))
            done()
          })
      }).timeout(10000)
    })

    describe('cleanUp', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')

      beforeEach(async () => {
        await fsEx.ensureDir(extensionPath)
      })

      afterEach(async () => {
        await fsEx.remove(extensionFolder)
      })

      it('should delete the extension directory', async () => {
        const state = {
          cloned: true,
          moved: true,
          extensionPath
        }

        assert.ok(await fsEx.exists(extensionPath))

        await subjectUnderTest._cleanUp(state, 'doesNotExist')

        assert.ok(!await fsEx.exists(extensionPath))
      })
    })
  })

  describe('extension upload', () => {
    let extensionsFolder
    let mockedFs

    let loggerInfoStub
    let loggerWarnStub
    let loggerErrorStub
    let inquirerPromptStub
    let getAllExtensionPropertiesStub

    before(async () => {
      loggerInfoStub = sinon.stub(logger, 'info')
      loggerWarnStub = sinon.stub(logger, 'warn')
      loggerErrorStub = sinon.stub(logger, 'error')
      inquirerPromptStub = sinon.stub(inquirer, 'prompt')
    })

    after(async () => {
      loggerInfoStub.restore()
      loggerWarnStub.restore()
      loggerErrorStub.restore()
      inquirerPromptStub.restore()

      mockFs.restore()
    })

    beforeEach(async () => {
      getAllExtensionPropertiesStub = sinon.stub(subjectUnderTest, '_getAllExtensionProperties').resolves([
        { id: '@acme/one', dir: 'acme-one' },
        { id: '@acme/two', dir: 'acme-two' },
        { id: '@acme/three', dir: 'acme-three' },
        { id: '@acme/theme', dir: 'acme-theme' }
      ])

      nock.disableNetConnect()

      extensionsFolder = path.join(subjectUnderTest.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
      mockedFs = {
        [extensionsFolder]: {
          'acme-one': { 'extension-config.json': '{"id": "@acme/one", "version": "1.0.0"}' },
          'acme-two': { 'extension-config.json': '{"id": "@acme/two"}' },
          'acme-three': {},
          'acme-theme': { 'extension-config.json': '{"id":"@acme/theme", "version": "1.0.0", "type":"theme"}' }
        }
      }

      mockFs(mockedFs)
    })

    afterEach(async () => {
      loggerInfoStub.reset()
      loggerWarnStub.reset()
      loggerErrorStub.reset()
      inquirerPromptStub.reset()

      nock.enableNetConnect()
      mockFs.restore()
    })

    it('should throw an error if an extension directory does not exist', async () => {
      mockFs.restore()
      mockFs({})

      try {
        await subjectUnderTest.uploadExtension({ extension: 'acme-four' })
        assert.fail('Expected to throw an error on the previous line')
      } catch (err) {
        assert.equal(err.message, 'Extension directory acme-four does not exist')
      }
    })

    it('should log a warning when no extensions are available to pick', async () => {
      getAllExtensionPropertiesStub.returns([])
      await subjectUnderTest.uploadExtension()

      sinon.assert.callCount(loggerWarnStub, 1)
      sinon.assert.callCount(inquirerPromptStub, 0)
    })

    it('should throw an error if extension-config.json is invalid', async () => {
      await subjectUnderTest.uploadExtension({ extension: 'acme-two' })
        .then(() => {
          assert.fail('Expected to throw an error')
        })
        .catch((err) => {
          assert.equal(err.message, 'Invalid extension-config.json')
        })
    })

    it('should throw an error if there is no extension-config.json', async () => {
      await subjectUnderTest.uploadExtension({ extension: 'acme-three' })
        .then(() => {
          assert.fail('Expected to throw an error')
        })
        .catch((err) => {
          assert.equal(err.message, 'There is no extension-config.json in acme-three')
        })
    })

    it('should throw an error if extension does not exist in DevCenter', async () => {
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}`)
        .reply(404, {
          code: 'NotFound',
          message: 'Extension Not found'
        })

      await subjectUnderTest.uploadExtension({ extension: 'acme-one' })
        .then(() => {
          assert.fail('Expected to throw an error')
        })
        .catch((err) => {
          assert.equal(err.message, 'Error getting @acme/one: Extension Not found')
        })
    })

    it('should throw an error if extension version does not exist in DevCenter', async () => {
      inquirerPromptStub.resolves({ createVersion: false })

      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}`)
        .reply(200)

      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0`)
        .reply(404, {
          code: 'ResourceNotFound',
          message: 'Version not found'
        })

      await subjectUnderTest.uploadExtension({ extension: 'acme-one' })
        .then(() => {
          assert.fail('Expected to throw an error')
        })
        .catch((err) => {
          assert.equal(err.message, 'Extension version 1.0.0 does not exist. Exiting.')
        })
    })

    it('should throw an error if another upload is in progress', async () => {
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}`)
        .reply(200)

      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0`)
        .reply(200, {
          status: 'PREPROCESSING'
        })

      await subjectUnderTest.uploadExtension({ extension: 'acme-one' })
        .then(() => {
          assert.fail('Expected to throw an error')
        })
        .catch((err) => {
          assert.equal(err.message, 'Another upload is in progress. Try later.')
        })
    })

    it('should pack and upload an extension', async () => {
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}`)
        .reply(200)

      let calls = 0
      let maxCalls = 4
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0`)
        .times(maxCalls)
        .reply((uri, requestBody) => {
          calls++

          switch (calls) {
            case 1:
              return [200, { status: 'DRAFT' }]

            case maxCalls:
              return [200, { status: 'UPLOADED' }]

            default:
              return [200, { status: 'PREPROCESSING' }]
          }
        })

      nock(SGCLOUD_DC_ADDRESS)
        .put(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0/file`)
        .reply(201)

      await subjectUnderTest.uploadExtension({ extension: 'acme-one' }, { pollInterval: 3 })

      sinon.assert.calledWith(loggerInfoStub, 'Extension version successfully uploaded')
    })

    it('should throw an error if upload was unsuccessfull', async () => {
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}`)
        .reply(200)

      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0/log`)
        .reply(200, {
          logs: [{
            name: 'ERROR OCCURED DURING UPLOAD'
          }]
        })

      let calls = 0
      let maxCalls = 4
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0`)
        .times(maxCalls)
        .reply(() => {
          calls++

          switch (calls) {
            case 1:
              return [200, { status: 'DRAFT' }]

            case maxCalls:
              return [200, { status: 'ERROR' }]

            default:
              return [200, { status: 'PREPROCESSING' }]
          }
        })

      nock(SGCLOUD_DC_ADDRESS)
        .put(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0/file`)
        .reply(201)

      await subjectUnderTest.uploadExtension({ extension: 'acme-one' }, { pollInterval: 3 })
        .then(() => {
          assert.fail('Expected to throw an error')
        })
        .catch((err) => {
          assert.equal(err.message, 'ERROR OCCURED DURING UPLOAD')
        })
    })

    it('should update a version if it is in UPLOADED state', async () => {
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}`)
        .reply(200)

      nock(SGCLOUD_DC_ADDRESS)
        .patch(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0`)
        .reply(200, { status: 'DRAFT' })

      let calls = 0
      let maxCalls = 4
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0`)
        .times(maxCalls)
        .reply((uri, requestBody) => {
          calls++

          switch (calls) {
            case 1:
              return [200, { status: 'UPLOADED' }]

            case maxCalls:
              return [200, { status: 'UPLOADED' }]

            default:
              return [200, { status: 'PREPROCESSING' }]
          }
        })

      nock(SGCLOUD_DC_ADDRESS)
        .put(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0/file`)
        .reply(201)

      await subjectUnderTest.uploadExtension({ extension: 'acme-one' }, { pollInterval: 3 })

      sinon.assert.calledWith(loggerInfoStub, 'Extension version successfully uploaded')
    })

    it('should create a version if it does not exist', async () => {
      inquirerPromptStub.resolves({ createVersion: true })

      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}`)
        .reply(200)

      nock(SGCLOUD_DC_ADDRESS)
        .post(`/extensions/${encodeURIComponent('@acme/one')}/versions`)
        .reply(201, { version: '1.0.0', status: 'DRAFT' })

      let calls = 0
      let maxCalls = 4
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0`)
        .times(maxCalls)
        .reply((uri, requestBody) => {
          calls++

          switch (calls) {
            case 1:
              return [404, {}]

            case maxCalls:
              return [200, { status: 'UPLOADED' }]

            default:
              return [200, { status: 'PREPROCESSING' }]
          }
        })

      nock(SGCLOUD_DC_ADDRESS)
        .put(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0/file`)
        .reply(201)

      await subjectUnderTest.uploadExtension({ extension: 'acme-one' }, { pollInterval: 3 })

      sinon.assert.calledWith(loggerInfoStub, 'Extension version successfully uploaded')
    })

    it('should throw an error if the upload has taken too much time', async () => {
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}`)
        .reply(200)

      let calls = 0
      let maxCalls = 4
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0`)
        .times(maxCalls)
        .reply(() => {
          calls++

          switch (calls) {
            case 1:
              return [200, { status: 'DRAFT' }]

            case maxCalls:
              return [200, { status: 'UPLOADED' }]

            default:
              return [200, { status: 'PREPROCESSING' }]
          }
        })

      nock(SGCLOUD_DC_ADDRESS)
        .put(`/extensions/${encodeURIComponent('@acme/one')}/versions/1.0.0/file`)
        .reply(201)

      await subjectUnderTest.uploadExtension({ extension: 'acme-one' }, { pollInterval: 100, preprocessTimeout: 10 })
        .then(() => {
          assert.fail('Expected to throw an error')
        })
        .catch((err) => {
          assert.equal(err.message, 'Preprocessing timeout expired. Try increasing the timeout with --preprocess-timeout option')
        })
    })

    it('should support `theme upload` command', async () => {
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/theme')}`)
        .reply(200)

      let calls = 0
      let maxCalls = 4
      nock(SGCLOUD_DC_ADDRESS)
        .get(`/extensions/${encodeURIComponent('@acme/theme')}/versions/1.0.0`)
        .times(maxCalls)
        .reply((uri, requestBody) => {
          calls++

          switch (calls) {
            case 1:
              return [200, { status: 'DRAFT' }]

            case maxCalls:
              return [200, { status: 'UPLOADED' }]

            default:
              return [200, { status: 'PREPROCESSING' }]
          }
        })

      nock(SGCLOUD_DC_ADDRESS)
        .put(`/extensions/${encodeURIComponent('@acme/theme')}/versions/1.0.0/file`)
        .reply(201)

      const isThemeSymbol = ExtensionAction.IS_THEME
      await subjectUnderTest.uploadExtension({ [isThemeSymbol]: true, extension: 'acme-theme' }, { pollInterval: 3 })

      sinon.assert.calledWith(loggerInfoStub, 'Theme version successfully uploaded')
    })
  })
})
